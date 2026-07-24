import { randomUUID } from 'node:crypto';

import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { authenticator } from 'otplib';
import request from 'supertest';
import { z } from 'zod';

import { AppModule } from '../src/app.module';
import { configureHttpApplication } from '../src/bootstrap/configure-http-application';
import { assertSafeTestDatabaseEnvironment } from '../src/common/database/database-safety';
import { hashToken, randomToken } from '../src/common/security/security-crypto';
import { AppConfigService } from '../src/config/app-config.service';
import { PrismaService } from '../src/database/prisma.service';
import { provisionAdminTestIdentity, type ProvisionedAdmin } from './setup/admin-test-client';

const loginSchema = z.object({
  data: z.object({
    user: z.object({
      id: z.uuid(),
      email: z.email(),
      roles: z.array(z.string()).min(1),
    }),
    session: z.object({
      id: z.uuid(),
      expiresAt: z.iso.datetime(),
      idleExpiresAt: z.iso.datetime(),
    }),
    csrfToken: z.string().min(32),
  }),
});

describe('ADMIN authentication and session security (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let config: AppConfigService;
  let identity: ProvisionedAdmin;
  let agent: ReturnType<typeof request.agent>;
  let csrfToken: string;
  let sessionId: string;

  beforeAll(async () => {
    assertSafeTestDatabaseEnvironment(process.env);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    config = moduleRef.get(AppConfigService);
    app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });
    configureHttpApplication(app, config);
    await app.init();
    prisma = app.get(PrismaService);
    identity = await provisionAdminTestIdentity(app);
    agent = request.agent(app.getHttpServer());

    const otp = authenticator.generate(identity.secret);
    const login = await agent
      .post('/api/v1/auth/login')
      .send({ email: identity.email, password: identity.password, otp })
      .expect(200);
    const parsed = loginSchema.parse(login.body);
    csrfToken = parsed.data.csrfToken;
    sessionId = parsed.data.session.id;
    expect(parsed.data.user.roles).toContain('ADMIN');
    expect(login.headers['set-cookie']?.[0]).toContain('HttpOnly');
    expect(login.headers['set-cookie']?.[0]).toContain('SameSite=Strict');
    expect(JSON.stringify(login.body)).not.toContain('cookieToken');
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires ADMIN session and CSRF while exposing only safe session fields', async () => {
    await request(app.getHttpServer()).get('/api/v1/admin/athletes').expect(401);
    await agent
      .post('/api/v1/admin/countries')
      .send({ isoAlpha2: 'ZX', isoAlpha3: 'ZXX', name: 'CSRF blocked' })
      .expect(403);

    const me = await agent.get('/api/v1/auth/me').expect(200);
    expect(me.body).toMatchObject({
      data: { userId: identity.userId, sessionId, roles: ['ADMIN'] },
    });
    const sessions = await agent.get('/api/v1/auth/sessions').expect(200);
    const [session] = z
      .object({ data: z.array(z.object({ id: z.uuid() }).loose()).min(1) })
      .parse(sessions.body).data;
    if (!session) throw new Error('Current session was not returned');
    expect(session).not.toHaveProperty('tokenHash');
    expect(session).not.toHaveProperty('csrfTokenHash');

    const preflight = await request(app.getHttpServer())
      .options('/api/v1/admin/countries')
      .set('Origin', 'http://localhost:3001')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type,x-csrf-token,x-request-id')
      .expect(204);
    expect(preflight.headers['access-control-allow-origin']).toBe('http://localhost:3001');
    expect(preflight.headers['access-control-allow-headers']?.toLowerCase()).toContain(
      'x-csrf-token',
    );
  });

  it('enforces permissions independently from the ADMIN role', async () => {
    const role = await prisma.role.findUniqueOrThrow({ where: { code: 'ADMIN' } });
    const permission = await prisma.permission.findUniqueOrThrow({
      where: { code: 'ADMIN_READ' },
    });
    await prisma.rolePermission.deleteMany({
      where: { roleId: role.id, permissionId: permission.id },
    });
    try {
      const denied = await agent.get('/api/v1/admin/athletes').expect(403);
      expect(denied.body).toMatchObject({ code: 'PERMISSION_DENIED' });
    } finally {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  });

  it('rotates one-time recovery codes, audits auth events and revokes logout', async () => {
    // Simulate the next TOTP window without making the suite wait for 30 seconds.
    await prisma.userCredential.update({
      where: { userId: identity.userId },
      data: { lastTotpStep: null },
    });
    const otp = authenticator.generate(identity.secret);
    const rotated = await agent
      .post('/api/v1/auth/recovery-codes')
      .set('X-CSRF-Token', csrfToken)
      .send({ otp })
      .expect(200);
    const recoveryCodes = z
      .object({ data: z.object({ recoveryCodes: z.array(z.string()).length(10) }) })
      .parse(rotated.body).data.recoveryCodes;

    await agent
      .post('/api/v1/auth/logout')
      .set('X-CSRF-Token', csrfToken)
      .expect(204);
    await agent.get('/api/v1/auth/me').expect(401);

    const recovered = await agent
      .post('/api/v1/auth/login')
      .send({
        email: identity.email,
        password: identity.password,
        recoveryCode: recoveryCodes[0],
      })
      .expect(200);
    csrfToken = loginSchema.parse(recovered.body).data.csrfToken;

    const concurrentAttempts = await Promise.all(
      [request(app.getHttpServer()), request(app.getHttpServer())].map((client) =>
        client.post('/api/v1/auth/login').send({
          email: identity.email,
          password: identity.password,
          recoveryCode: recoveryCodes[1],
        }),
      ),
    );
    expect(concurrentAttempts.map(({ status }) => status).sort()).toEqual([200, 401]);

    const authAuditCount = await prisma.auditLog.count({
      where: {
        actorId: identity.userId,
        action: { in: ['AUTH_LOGIN', 'AUTH_LOGOUT', 'AUTH_RECOVERY_CODES_ROTATED'] },
      },
    });
    expect(authAuditCount).toBeGreaterThanOrEqual(3);
  });

  it('lists and revokes another administrator session immediately', async () => {
    const secondAgent = request.agent(app.getHttpServer());
    const secondCookieToken = randomToken();
    const secondSession = await prisma.adminSession.create({
      data: {
        userId: identity.userId,
        tokenHash: hashToken(secondCookieToken),
        csrfTokenHash: hashToken(randomToken()),
        secondFactorMethod: 'TOTP',
        expiresAt: new Date(Date.now() + 60 * 60_000),
        idleExpiresAt: new Date(Date.now() + 30 * 60_000),
      },
    });

    await agent
      .delete(`/api/v1/auth/sessions/${secondSession.id}`)
      .set('X-CSRF-Token', csrfToken)
      .set('X-Confirm-Action', 'true')
      .set('X-Action-Reason', 'Revoke a secondary integration-test session')
      .expect(204);
    await secondAgent
      .get('/api/v1/auth/me')
      .set('Cookie', `${config.authCookieName}=${secondCookieToken}`)
      .expect(401);
    await expect(
      prisma.auditLog.findFirstOrThrow({
        where: {
          actorId: identity.userId,
          action: 'AUTH_SESSION_REVOKE',
          entityId: secondSession.id,
        },
      }),
    ).resolves.toBeDefined();
  });

  it('writes an administrative mutation audit inside the domain transaction', async () => {
    const suffix = randomUUID().slice(0, 8);
    const requestId = randomUUID();
    const created = await agent
      .post('/api/v1/admin/disciplines')
      .set('X-CSRF-Token', csrfToken)
      .set('X-Request-Id', requestId)
      .set('Idempotency-Key', randomUUID())
      .send({ code: `AUDIT_${suffix}`, name: `Audit ${suffix}` })
      .expect(201);
    const disciplineId = z
      .object({ data: z.object({ id: z.uuid() }) })
      .parse(created.body).data.id;
    const audit = await prisma.auditLog.findFirst({
      where: {
        actorId: identity.userId,
        entityType: 'Discipline',
        entityId: disciplineId,
        action: 'CREATE',
        requestId,
      },
    });
    expect(audit).not.toBeNull();

    const updatedName = `Audit updated ${suffix}`;
    await agent
      .patch(`/api/v1/admin/disciplines/${disciplineId}`)
      .set('X-CSRF-Token', csrfToken)
      .set('If-Match', '1')
      .set('X-Action-Reason', 'Correct the discipline display name')
      .send({ name: updatedName })
      .expect(200);
    const updateAudit = await prisma.auditLog.findFirstOrThrow({
      where: {
        actorId: identity.userId,
        sessionId: { not: null },
        entityType: 'Discipline',
        entityId: disciplineId,
        action: 'UPDATE',
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(updateAudit.reason).toBe('Correct the discipline display name');
    expect(updateAudit.oldData).toMatchObject({ name: `Audit ${suffix}` });
    expect(updateAudit.newData).toMatchObject({
      method: 'PATCH',
      payload: { name: updatedName },
    });
    await request(app.getHttpServer()).get('/api/v1/admin/audit-logs').expect(401);
    const listed = await agent
      .get('/api/v1/admin/audit-logs')
      .query({ entityId: disciplineId, action: 'UPDATE', page: 1, limit: 10 })
      .expect(200);
    expect(
      z
        .object({
          data: z.array(z.object({ id: z.uuid(), action: z.literal('UPDATE') }).loose()),
          meta: z.object({ total: z.number().int().positive() }).loose(),
        })
        .parse(listed.body).data,
    ).toEqual(expect.arrayContaining([expect.objectContaining({ id: updateAudit.id })]));
  });

  it('rolls back the domain write when the atomic audit insert fails', async () => {
    const requestId = `audit-rollback-${randomUUID()}`;
    const code = `ROLLBACK_${randomUUID().slice(0, 8)}`;
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION "reject_selected_audit_insert"()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        IF NEW."requestId" LIKE 'audit-rollback-%' THEN
          RAISE EXCEPTION 'Injected audit failure';
        END IF;
        RETURN NEW;
      END;
      $$;
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER "AuditLog_reject_selected_insert"
      BEFORE INSERT ON "AuditLog"
      FOR EACH ROW EXECUTE FUNCTION "reject_selected_audit_insert"();
    `);
    try {
      await agent
        .post('/api/v1/admin/disciplines')
        .set('X-CSRF-Token', csrfToken)
        .set('X-Request-Id', requestId)
        .set('Idempotency-Key', randomUUID())
        .send({ code, name: `Rollback ${code}` })
        .expect(500);
      expect(await prisma.discipline.count({ where: { code } })).toBe(0);
    } finally {
      await prisma.$executeRawUnsafe(
        'DROP TRIGGER IF EXISTS "AuditLog_reject_selected_insert" ON "AuditLog";',
      );
      await prisma.$executeRawUnsafe(
        'DROP FUNCTION IF EXISTS "reject_selected_audit_insert"();',
      );
    }
  });

  it('atomically replays an administrative POST with the same idempotency key', async () => {
    const suffix = randomUUID().slice(0, 8);
    const key = `discipline-${randomUUID()}`;
    const payload = { code: `IDEMPOTENT_${suffix}`, name: `Idempotent ${suffix}` };
    const attempts = await Promise.all([
      agent
        .post('/api/v1/admin/disciplines')
        .set('X-CSRF-Token', csrfToken)
        .set('Idempotency-Key', key)
        .send(payload),
      agent
        .post('/api/v1/admin/disciplines')
        .set('X-CSRF-Token', csrfToken)
        .set('Idempotency-Key', key)
        .send(payload),
    ]);
    expect(attempts.map(({ status }) => status)).toEqual([201, 201]);
    const responseBodies = attempts.map((response) => {
      const body: unknown = response.body;
      return z
        .object({ data: z.object({ id: z.uuid(), code: z.string(), name: z.string() }).loose() })
        .parse(body);
    });
    expect(responseBodies[0]).toEqual(responseBodies[1]);
    expect(
      attempts.filter(({ headers }) => headers['idempotency-replayed'] === 'true'),
    ).toHaveLength(1);
    const discipline = await prisma.discipline.findUniqueOrThrow({
      where: { code: payload.code },
    });
    expect(await prisma.discipline.count({ where: { code: payload.code } })).toBe(1);
    expect(
      await prisma.auditLog.count({
        where: {
          action: 'CREATE',
          entityType: 'Discipline',
          entityId: discipline.id,
        },
      }),
    ).toBe(1);

    await agent
      .post('/api/v1/admin/disciplines')
      .set('X-CSRF-Token', csrfToken)
      .set('Idempotency-Key', key)
      .send({ ...payload, name: 'Conflicting payload' })
      .expect(409);
  });
});

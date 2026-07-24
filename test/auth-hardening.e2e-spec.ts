import * as argon2 from 'argon2';
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

const authenticatedSchema = z.object({
  data: z.object({
    session: z.object({ id: z.uuid() }),
    csrfToken: z.string().min(32),
  }),
});

describe('ADMIN authentication hardening (e2e)', () => {
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
  });

  beforeEach(async () => {
    identity = await provisionAdminTestIdentity(app);
    agent = request.agent(app.getHttpServer());
    const login = await agent
      .post('/api/v1/auth/login')
      .send({
        email: identity.email,
        password: identity.password,
        otp: authenticator.generate(identity.secret),
      })
      .expect(200);
    const authenticated = authenticatedSchema.parse(login.body).data;
    csrfToken = authenticated.csrfToken;
    sessionId = authenticated.session.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects an idle-expired session without extending it', async () => {
    const expiredAt = new Date(Date.now() - 1_000);
    await prisma.adminSession.update({
      where: { id: sessionId },
      data: {
        createdAt: new Date(Date.now() - 2 * 60 * 60_000),
        lastSeenAt: new Date(Date.now() - 60 * 60_000),
        idleExpiresAt: expiredAt,
      },
    });

    await agent.get('/api/v1/auth/me').expect(401);
    const persisted = await prisma.adminSession.findUniqueOrThrow({
      where: { id: sessionId },
    });
    expect(persisted.idleExpiresAt).toEqual(expiredAt);
  });

  it('changes the password atomically and immediately revokes other sessions', async () => {
    const secondToken = randomToken();
    const secondSession = await prisma.adminSession.create({
      data: {
        userId: identity.userId,
        tokenHash: hashToken(secondToken),
        csrfTokenHash: hashToken(randomToken()),
        secondFactorMethod: 'TOTP',
        expiresAt: new Date(Date.now() + 60 * 60_000),
        idleExpiresAt: new Date(Date.now() + 30 * 60_000),
      },
    });
    await prisma.userCredential.update({
      where: { userId: identity.userId },
      data: { lastTotpStep: null },
    });
    const newPassword = 'Replacement-Integration-Password-2026!';

    await agent
      .post('/api/v1/auth/password')
      .set('X-CSRF-Token', csrfToken)
      .send({
        currentPassword: identity.password,
        newPassword,
        otp: authenticator.generate(identity.secret),
      })
      .expect(204);

    await agent.get('/api/v1/auth/me').expect(200);
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', `${config.authCookieName}=${secondToken}`)
      .expect(401);
    const [credential, revoked] = await Promise.all([
      prisma.userCredential.findUniqueOrThrow({ where: { userId: identity.userId } }),
      prisma.adminSession.findUniqueOrThrow({ where: { id: secondSession.id } }),
    ]);
    await expect(argon2.verify(credential.passwordHash, newPassword)).resolves.toBe(true);
    expect(revoked.revokeReason).toBe('PASSWORD_CHANGED');
    expect(revoked.revokedAt).not.toBeNull();
  });

  it('allows only one concurrent sensitive action for a TOTP timestep', async () => {
    await prisma.userCredential.update({
      where: { userId: identity.userId },
      data: { lastTotpStep: null },
    });
    const otp = authenticator.generate(identity.secret);
    const auditCountBefore = await prisma.auditLog.count({
      where: {
        actorId: identity.userId,
        action: 'AUTH_RECOVERY_CODES_ROTATED',
      },
    });
    const attempts = await Promise.all([
      agent.post('/api/v1/auth/recovery-codes').set('X-CSRF-Token', csrfToken).send({ otp }),
      agent.post('/api/v1/auth/recovery-codes').set('X-CSRF-Token', csrfToken).send({ otp }),
    ]);

    expect(attempts.map(({ status }) => status).sort()).toEqual([200, 401]);
    expect(
      await prisma.auditLog.count({
        where: {
          actorId: identity.userId,
          action: 'AUTH_RECOVERY_CODES_ROTATED',
        },
      }),
    ).toBe(auditCountBefore + 1);
    expect(
      await prisma.adminRecoveryCode.count({
        where: { userId: identity.userId, usedAt: null },
      }),
    ).toBe(10);
  });
});

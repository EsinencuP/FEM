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
import { provisionAdminTestIdentity } from './setup/admin-test-client';

const issuedSessionSchema = z.object({
  data: z.object({
    session: z.object({ id: z.uuid() }),
    csrfToken: z.string().min(32),
  }),
});

function cookieFrom(response: request.Response): string {
  const cookie = response.headers['set-cookie']?.[0]?.split(';', 1)[0];
  if (!cookie) throw new Error('Expected an administrator session cookie');
  return cookie;
}

describe('ADMIN session rotation and 2FA recovery lifecycle (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    assertSafeTestDatabaseEnvironment(process.env);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const config = moduleRef.get(AppConfigService);
    app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });
    configureHttpApplication(app, config);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepts a TOTP timestep only once under concurrent login', async () => {
    const identity = await provisionAdminTestIdentity(app);
    const payload = {
      email: identity.email,
      password: identity.password,
      otp: authenticator.generate(identity.secret),
    };
    const attempts = await Promise.all([
      request(app.getHttpServer()).post('/api/v1/auth/login').send(payload),
      request(app.getHttpServer()).post('/api/v1/auth/login').send(payload),
    ]);
    expect(attempts.map(({ status }) => status).sort()).toEqual([200, 401]);
    expect(
      await prisma.adminSession.count({ where: { userId: identity.userId, revokedAt: null } }),
    ).toBe(1);
  });

  it('allows one concurrent refresh winner and detects later reuse of the old token', async () => {
    const identity = await provisionAdminTestIdentity(app);
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: identity.email,
        password: identity.password,
        otp: authenticator.generate(identity.secret),
      })
      .expect(200);
    const originalCookie = cookieFrom(login);
    const issued = issuedSessionSchema.parse(login.body);
    const refreshes = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', originalCookie)
        .set('X-CSRF-Token', issued.data.csrfToken),
      request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', originalCookie)
        .set('X-CSRF-Token', issued.data.csrfToken),
    ]);
    expect(refreshes.map(({ status }) => status).sort()).toEqual([200, 401]);
    const winner = refreshes.find(({ status }) => status === 200);
    if (!winner) throw new Error('Expected one successful session refresh');
    const rotatedCookie = cookieFrom(winner);
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', rotatedCookie)
      .expect(200);

    await prisma.adminSession.update({
      where: { id: issued.data.session.id },
      data: { previousTokenExpiresAt: new Date(Date.now() - 1) },
    });
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', originalCookie)
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', rotatedCookie)
      .expect(401);
  });

  it('re-enrolls a lost TOTP factor once from a recovery-code session', async () => {
    const identity = await provisionAdminTestIdentity(app);
    const initialRecoveryCode = randomToken(12).toUpperCase();
    await prisma.adminRecoveryCode.create({
      data: { userId: identity.userId, codeHash: hashToken(initialRecoveryCode) },
    });
    const recoveryLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: identity.email,
        password: identity.password,
        recoveryCode: initialRecoveryCode,
      })
      .expect(200);
    const cookie = cookieFrom(recoveryLogin);
    const issued = issuedSessionSchema.parse(recoveryLogin.body);
    const started = await request(app.getHttpServer())
      .post('/api/v1/auth/totp/re-enrollment')
      .set('Cookie', cookie)
      .set('X-CSRF-Token', issued.data.csrfToken)
      .send({ currentPassword: identity.password })
      .expect(200);
    const secret = z.object({ data: z.object({ secret: z.string().min(16) }) }).parse(started.body)
      .data.secret;
    const confirmation = {
      otp: authenticator.generate(secret),
    };
    const confirmations = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/auth/totp/re-enrollment/confirm')
        .set('Cookie', cookie)
        .set('X-CSRF-Token', issued.data.csrfToken)
        .send(confirmation),
      request(app.getHttpServer())
        .post('/api/v1/auth/totp/re-enrollment/confirm')
        .set('Cookie', cookie)
        .set('X-CSRF-Token', issued.data.csrfToken)
        .send(confirmation),
    ]);
    const statuses = confirmations.map(({ status }) => status).sort();
    expect(statuses[0]).toBe(200);
    expect([403, 409]).toContain(statuses[1]);
    const winner = confirmations.find(({ status }) => status === 200);
    if (!winner) throw new Error('Expected one successful TOTP confirmation');
    const loser = confirmations.find(({ status }) => status !== 200);
    const loserError = z.object({ code: z.string() }).parse(loser?.body as unknown);
    expect(['RECOVERY_SESSION_REQUIRED', 'TOTP_REENROLLMENT_ALREADY_USED']).toContain(
      loserError.code,
    );
    const recoveryCode = z
      .object({
        data: z.object({ recoveryCodes: z.array(z.string()).length(10) }),
      })
      .parse(winner.body).data.recoveryCodes[0];
    if (!recoveryCode) throw new Error('Expected a replacement recovery code');

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: identity.email,
        password: identity.password,
        recoveryCode,
      })
      .expect(200);
    await expect(
      prisma.auditLog.findFirstOrThrow({
        where: { actorId: identity.userId, action: 'AUTH_TOTP_REENROLLED' },
      }),
    ).resolves.toBeDefined();
  });
});

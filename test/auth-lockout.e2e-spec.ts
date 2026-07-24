import { randomUUID } from 'node:crypto';

import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { configureHttpApplication } from '../src/bootstrap/configure-http-application';
import { assertSafeTestDatabaseEnvironment } from '../src/common/database/database-safety';
import { AppConfigService } from '../src/config/app-config.service';
import { PrismaService } from '../src/database/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { provisionAdminTestIdentity } from './setup/admin-test-client';

describe('ADMIN login lockout (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    assertSafeTestDatabaseEnvironment(process.env);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const config = moduleRef.get(AppConfigService);
    app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });
    configureHttpApplication(app, config);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('locks a known administrator after the configured failed-attempt threshold', async () => {
    const identity = await provisionAdminTestIdentity(app);
    const config = app.get(AppConfigService);
    const auth = app.get(AuthService);
    const attempts = await Promise.allSettled(
      Array.from({ length: config.authMaxFailedAttempts + 2 }, () =>
        auth.login(
          {
            email: identity.email,
            password: 'Wrong-Password-For-Lockout!',
            otp: '000000',
          },
          { requestId: randomUUID(), ipAddress: '127.0.0.1', userAgent: 'lockout-test' },
        ),
      ),
    );
    expect(attempts.every(({ status }) => status === 'rejected')).toBe(true);

    const prisma = app.get(PrismaService);
    const credential = await prisma.userCredential.findUniqueOrThrow({
      where: { userId: identity.userId },
    });
    expect(credential.lockedUntil?.getTime()).toBeGreaterThan(Date.now());
    await expect(
      prisma.auditLog.findFirstOrThrow({
        where: {
          actorId: null,
          entityId: identity.userId,
          action: 'AUTH_ACCOUNT_LOCKED',
        },
      }),
    ).resolves.toBeDefined();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: identity.email,
          password: 'Wrong-Password-For-Lockout!',
          otp: '000000',
        })
        .expect(401);
    }
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: identity.email,
        password: 'Wrong-Password-For-Lockout!',
        otp: '000000',
      })
      .expect(429);
  });
});

import { randomUUID } from 'node:crypto';

import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { authenticator } from 'otplib';
import request from 'supertest';
import { z } from 'zod';

import { AppModule } from '../src/app.module';
import { configureHttpApplication } from '../src/bootstrap/configure-http-application';
import { assertSafeTestDatabaseEnvironment } from '../src/common/database/database-safety';
import { AppConfigService } from '../src/config/app-config.service';
import { PrismaService } from '../src/database/prisma.service';
import { provisionAdminTestIdentity } from './setup/admin-test-client';

describe('ADMIN audit with a configurable API prefix (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    assertSafeTestDatabaseEnvironment(process.env);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const config = moduleRef.get(AppConfigService);
    app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });
    configureHttpApplication(app, {
      apiPrefix: 'backend',
      corsAllowedOrigins: config.corsAllowedOrigins,
      hstsEnabled: config.hstsEnabled,
      isProduction: config.isProduction,
      trustProxyHops: config.trustProxyHops,
    });
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('records an actor-attributed mutation without assuming the literal api prefix', async () => {
    const identity = await provisionAdminTestIdentity(app);
    const agent = request.agent(app.getHttpServer());
    const login = await agent
      .post('/backend/v1/auth/login')
      .send({
        email: identity.email,
        password: identity.password,
        otp: authenticator.generate(identity.secret),
      })
      .expect(200);
    const csrfToken = z
      .object({ data: z.object({ csrfToken: z.string() }) })
      .parse(login.body).data.csrfToken;
    const sessionCookie = login.headers['set-cookie']?.[0]?.split(';', 1)[0];
    if (!sessionCookie) throw new Error('Login did not return the administrator session cookie');
    const requestId = randomUUID();
    const suffix = randomUUID().slice(0, 8);
    const created = await agent
      .post('/backend/v1/admin/disciplines')
      .set('Cookie', sessionCookie)
      .set('X-CSRF-Token', csrfToken)
      .set('X-Request-Id', requestId)
      .set('Idempotency-Key', randomUUID())
      .send({ code: `PREFIX_${suffix}`, name: `Prefix ${suffix}` })
      .expect(201);
    const entityId = z
      .object({ data: z.object({ id: z.uuid() }) })
      .parse(created.body).data.id;

    await expect(
      prisma.auditLog.findFirstOrThrow({
        where: {
          actorId: identity.userId,
          action: 'CREATE',
          entityType: 'Discipline',
          entityId,
          requestId,
        },
      }),
    ).resolves.toBeDefined();
  });
});

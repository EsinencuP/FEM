import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { configureHttpApplication } from '../src/bootstrap/configure-http-application';
import { assertSafeTestDatabaseEnvironment } from '../src/common/database/database-safety';
import { AppConfigService } from '../src/config/app-config.service';
import { PrismaService } from '../src/database/prisma.service';
import { provisionAdminTestIdentity } from './setup/admin-test-client';

async function createApplication(): Promise<NestExpressApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const config = moduleRef.get(AppConfigService);
  const app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });
  configureHttpApplication(app, config);
  await app.init();
  return app;
}

describe('shared production-style rate-limit storage (e2e)', () => {
  let first: NestExpressApplication;
  let second: NestExpressApplication;

  beforeAll(async () => {
    assertSafeTestDatabaseEnvironment(process.env);
    [first, second] = await Promise.all([createApplication(), createApplication()]);
  });

  afterAll(async () => {
    await Promise.all([first.close(), second.close()]);
  });

  it('shares the login quota across instances and ignores spoofed forwarding headers', async () => {
    const identity = await provisionAdminTestIdentity(first);
    const config = first.get(AppConfigService);
    const payload = {
      email: identity.email,
      password: 'Wrong-Password-For-Distributed-Rate-Limit!',
      otp: '000000',
    };
    for (let attempt = 0; attempt < config.rateLimitAuthPerMinute; attempt += 1) {
      const target = attempt % 2 === 0 ? first : second;
      await request(target.getHttpServer())
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', `203.0.113.${String(attempt + 10)}`)
        .send(payload)
        .expect(401);
    }
    await request(second.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', '198.51.100.200')
      .send(payload)
      .expect(429);

    const prisma = first.get(PrismaService);
    expect(
      await prisma.rateLimitBucket.count({ where: { throttlerName: 'auth' } }),
    ).toBeGreaterThan(0);
  });
});

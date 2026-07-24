import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { configureHttpApplication } from '../src/bootstrap/configure-http-application';
import { assertSafeTestDatabaseEnvironment } from '../src/common/database/database-safety';
import { PostgresThrottlerStorage } from '../src/common/security/postgres-throttler-storage';
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
    const authBucket = await prisma.rateLimitBucket.findFirstOrThrow({
      where: { throttlerName: 'auth' },
      orderBy: { updatedAt: 'desc' },
    });
    const expiredWindowStart = new Date(Date.now() - 2_000);
    const blockedUntil = new Date(Date.now() + 60_000);
    await prisma.rateLimitBucket.update({
      where: { key: authBucket.key },
      data: {
        windowStartedAt: expiredWindowStart,
        expiresAt: new Date(Date.now() - 1_000),
        blockedUntil,
      },
    });
    await request(first.getHttpServer()).post('/api/v1/auth/login').send(payload).expect(429);
    await expect(
      prisma.rateLimitBucket.findUniqueOrThrow({ where: { key: authBucket.key } }),
    ).resolves.toMatchObject({ blockedUntil });

    await prisma.rateLimitBucket.update({
      where: { key: authBucket.key },
      data: {
        windowStartedAt: new Date(Date.now() - 2_000),
        expiresAt: new Date(Date.now() - 1_000),
        blockedUntil: new Date(Date.now() - 500),
      },
    });
    await request(first.getHttpServer()).post('/api/v1/auth/login').send(payload).expect(401);
    await expect(
      prisma.rateLimitBucket.findUniqueOrThrow({ where: { key: authBucket.key } }),
    ).resolves.toMatchObject({ totalHits: 1, blockedUntil: null });
  });

  it('reclaims expired buckets with bounded opportunistic retention', async () => {
    const prisma = first.get(PrismaService);
    const now = Date.now();
    const staleKeys = Array.from({ length: 750 }, (_, index) => `stale-rate-limit-${now}-${index}`);
    await prisma.rateLimitBucket.createMany({
      data: staleKeys.map((key) => ({
        key,
        throttlerName: 'retention-test',
        windowStartedAt: new Date(now - 120_000),
        expiresAt: new Date(now - 60_000),
        totalHits: 1,
      })),
    });

    const storages = [first.get(PostgresThrottlerStorage), second.get(PostgresThrottlerStorage)];
    await Promise.all(
      storages.map(async (storage, storageIndex) => {
        for (let index = 0; index < 128; index += 1) {
          await storage.increment(
            `retention-probe-${storageIndex}`,
            60_000,
            10_000,
            60_000,
            'retention-test',
          );
        }
      }),
    );

    await expect(prisma.rateLimitBucket.count({ where: { key: { in: staleKeys } } })).resolves.toBe(
      0,
    );
  });
});

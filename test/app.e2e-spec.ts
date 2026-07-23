import type { Server } from 'node:http';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { z } from 'zod';

import { AppModule } from '../src/app.module';
import { ApiExceptionFilter } from '../src/common/filters/api-exception.filter';
import { ZodValidationPipe } from '../src/common/pipes/zod-validation.pipe';
import { AppConfigService } from '../src/config/app-config.service';

const healthResponseSchema = z.object({
  status: z.literal('ok'),
  database: z.literal('connected'),
  timestamp: z.iso.datetime(),
});

const listResponseSchema = z.object({
  data: z.array(z.unknown()),
  meta: z.object({
    page: z.number().int().positive(),
    limit: z.number().int().positive().max(100),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  }),
});

describe('Application (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const config = moduleRef.get(AppConfigService);

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(config.apiPrefix);
    app.useGlobalPipes(new ZodValidationPipe());
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health reports live PostgreSQL connectivity', async () => {
    const server = app.getHttpServer() as Server;
    const response = await request(server).get('/api/health').expect(200);
    const rawBody: unknown = response.body;
    const body = healthResponseSchema.parse(rawBody);

    expect(body.status).toBe('ok');
    expect(body.database).toBe('connected');
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it.each([
    '/api/v1/countries',
    '/api/v1/disciplines',
    '/api/v1/clubs',
    '/api/v1/owners',
    '/api/v1/athletes',
    '/api/v1/horses',
    '/api/v1/competitions',
    '/api/v1/competition-classes',
    '/api/v1/results',
  ])('GET %s returns the common paginated envelope', async (path) => {
    const server = app.getHttpServer() as Server;
    const response = await request(server).get(path).query({ page: 1, limit: 1 }).expect(200);

    expect(listResponseSchema.parse(response.body)).toMatchObject({
      meta: { page: 1, limit: 1 },
    });
  });

  it('rejects an excessive page size using the common validation error', async () => {
    const server = app.getHttpServer() as Server;
    const response = await request(server)
      .get('/api/v1/horses')
      .query({ page: 1, limit: 101 })
      .expect(400);

    expect(response.body).toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      path: '/api/v1/horses?page=1&limit=101',
    });
  });
});

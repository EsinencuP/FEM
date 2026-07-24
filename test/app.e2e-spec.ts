import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { z } from 'zod';

import { AppModule } from '../src/app.module';
import { configureHttpApplication } from '../src/bootstrap/configure-http-application';
import { AppConfigService } from '../src/config/app-config.service';
import {
  createAdminTestClient,
} from './setup/admin-test-client';
import type { AdminTestClient } from './setup/admin-test-client';

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
  let app: NestExpressApplication;
  let adminRequest: AdminTestClient;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const config = moduleRef.get(AppConfigService);

    app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });
    configureHttpApplication(app, config);
    await app.init();
    adminRequest = await createAdminTestClient(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health reports live PostgreSQL connectivity', async () => {
    const response = await adminRequest.get('/api/health').expect(200);
    const rawBody: unknown = response.body;
    const body = healthResponseSchema.parse(rawBody);

    expect(body.status).toBe('ok');
    expect(body.database).toBe('connected');
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(response.headers['referrer-policy']).toBeDefined();
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['strict-transport-security']).toBeUndefined();
  });

  it.each([
    '/api/v1/admin/countries',
    '/api/v1/admin/disciplines',
    '/api/v1/admin/clubs',
    '/api/v1/admin/owners',
    '/api/v1/admin/athletes',
    '/api/v1/admin/horses',
    '/api/v1/admin/competitions',
    '/api/v1/admin/competition-classes',
    '/api/v1/admin/results',
  ])('GET %s returns the common paginated envelope', async (path) => {
    const response = await adminRequest.get(path).query({ page: 1, limit: 1 }).expect(200);

    expect(listResponseSchema.parse(response.body)).toMatchObject({
      meta: { page: 1, limit: 1 },
    });
  });

  it('rejects an excessive page size using the common validation error', async () => {
    const response = await adminRequest
      .get('/api/v1/admin/horses')
      .query({ page: 1, limit: 101 })
      .expect(400);

    expect(response.body).toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      path: '/api/v1/admin/horses?page=1&limit=101',
    });
  });

  it('allows configured frontend origins and rejects unlisted origins', async () => {
    const allowedOrigins = app.get(AppConfigService).corsAllowedOrigins;

    const allowedOrigin = allowedOrigins.at(0);
    if (!allowedOrigin) {
      throw new Error('CORS_ALLOWED_ORIGINS must contain a test origin');
    }
    const allowed = await adminRequest
      .options('/api/v1/admin/athletes')
      .set('Origin', allowedOrigin)
      .set('Access-Control-Request-Method', 'GET')
      .expect(204);
    expect(allowed.headers['access-control-allow-origin']).toBe(allowedOrigin);
    expect(allowed.headers['access-control-expose-headers']).toContain('X-Request-Id');

    const rejected = await adminRequest
      .options('/api/v1/admin/athletes')
      .set('Origin', 'https://untrusted.example')
      .set('Access-Control-Request-Method', 'GET')
      .expect(204);
    expect(rejected.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('paginates nested identifiers and enforces the common maximum limit', async () => {
    const athletes = await adminRequest
      .get('/api/v1/admin/athletes')
      .query({ page: 1, limit: 1 })
      .expect(200);
    const [athlete] = z
      .object({ data: z.array(z.object({ id: z.uuid() })).min(1) })
      .parse(athletes.body).data;
    if (!athlete) throw new Error('Seeded athlete is required for identifier pagination test');
    const athleteId = athlete.id;

    const page = await adminRequest
      .get(`/api/v1/admin/athletes/${athleteId}/identifiers`)
      .query({ page: 1, limit: 1 })
      .expect(200);
    expect(listResponseSchema.parse(page.body)).toMatchObject({
      meta: { page: 1, limit: 1 },
    });

    await adminRequest
      .get(`/api/v1/admin/athletes/${athleteId}/identifiers`)
      .query({ page: 1, limit: 101 })
      .expect(400);
  });

  it('returns the documented competition event projection in nested results', async () => {
    const competitions = await adminRequest
      .get('/api/v1/admin/competitions')
      .query({ page: 1, limit: 1 })
      .expect(200);
    const [competition] = z
      .object({ data: z.array(z.object({ id: z.uuid() })).min(1) })
      .parse(competitions.body).data;
    if (!competition) throw new Error('Seeded competition is required for projection test');

    const response = await adminRequest
      .get(`/api/v1/admin/competitions/${competition.id}/results`)
      .query({ page: 1, limit: 1 })
      .expect(200);
    const parsed = z
      .object({
        data: z
          .array(
            z.object({
              competitionClass: z.object({
                id: z.uuid(),
                title: z.string(),
                competitionEvent: z.object({
                  id: z.uuid(),
                  title: z.string(),
                  slug: z.string(),
                }),
              }),
            }),
          )
          .min(1),
      })
      .parse(response.body);
    expect(parsed.data[0]?.competitionClass.competitionEvent.id).toBe(competition.id);
  });

  it('rejects unauthenticated and missing-CSRF administrative requests', async () => {
    const server = app.getHttpServer();
    await request(server).get('/api/v1/admin/athletes').expect(401);
    await request(server)
      .post('/api/v1/admin/countries')
      .send({ isoAlpha2: 'ZZ', isoAlpha3: 'ZZZ', name: 'Unauthorized' })
      .expect(401);
  });
});

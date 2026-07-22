import type { Server } from 'node:http';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { z } from 'zod';

import { AppModule } from '../src/app.module';
import { AppConfigService } from '../src/config/app-config.service';

const healthResponseSchema = z.object({
  status: z.literal('ok'),
  database: z.literal('connected'),
  timestamp: z.iso.datetime(),
});

describe('Application (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const config = moduleRef.get(AppConfigService);

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(config.apiPrefix);
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
});

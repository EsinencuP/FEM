import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';
import { z } from 'zod';

import { AppModule } from '../src/app.module';
import { configureHttpApplication } from '../src/bootstrap/configure-http-application';
import { createOpenApiDocument } from '../src/bootstrap/openapi';
import { protectSwagger } from '../src/bootstrap/protect-swagger';
import { assertSafeTestDatabaseEnvironment } from '../src/common/database/database-safety';
import { AppConfigService } from '../src/config/app-config.service';

describe('production Swagger protection (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    assertSafeTestDatabaseEnvironment(process.env);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const config = moduleRef.get(AppConfigService);
    app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });
    configureHttpApplication(app, config);
    protectSwagger(app, {
      apiPrefix: config.apiPrefix,
      isProduction: true,
      swaggerUsername: 'release-reviewer',
      swaggerPassword: 'Swagger-Protection-Test:2026!',
    });
    SwaggerModule.setup(`${config.apiPrefix}/docs`, app, createOpenApiDocument(app), {
      jsonDocumentUrl: `${config.apiPrefix}/docs-json`,
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('challenges anonymous access using the standard safe error contract', async () => {
    const response = await request(app.getHttpServer()).get('/api/docs-json').expect(401);
    const body: unknown = response.body;
    expect(response.headers['www-authenticate']).toContain('Basic');
    expect(body).toMatchObject({
      statusCode: 401,
      error: 'Unauthorized',
      code: 'DOCUMENTATION_AUTH_REQUIRED',
      path: '/api/docs-json',
    });
    const parsed = z
      .object({ requestId: z.string().min(1), timestamp: z.iso.datetime() })
      .loose()
      .parse(body);
    expect(parsed.requestId).toBeTruthy();
    expect(parsed.timestamp).toBeTruthy();
  });

  it('serves documentation with the exact configured Basic credentials', async () => {
    const credentials = Buffer.from(
      'release-reviewer:Swagger-Protection-Test:2026!',
      'utf8',
    ).toString('base64');
    const response = await request(app.getHttpServer())
      .get('/api/docs-json')
      .set('Authorization', `Basic ${credentials}`)
      .expect(200);
    const body: unknown = response.body;
    expect(z.object({ openapi: z.literal('3.0.0') }).loose().parse(body)).toBeDefined();
  });
});

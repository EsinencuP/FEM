import { Logger } from 'nestjs-pino';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { configureHttpApplication } from './bootstrap/configure-http-application';
import { createOpenApiDocument } from './bootstrap/openapi';
import { protectSwagger } from './bootstrap/protect-swagger';
import { AppConfigService } from './config/app-config.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });
  const config = app.get(AppConfigService);
  const logger = app.get(Logger);

  app.useLogger(logger);
  app.enableShutdownHooks();
  configureHttpApplication(app, config);

  if (config.swaggerEnabled) {
    protectSwagger(app, config);
    const openApiDocument = createOpenApiDocument(app);
    SwaggerModule.setup(`${config.apiPrefix}/docs`, app, openApiDocument, {
      jsonDocumentUrl: `${config.apiPrefix}/docs-json`,
    });
  }

  await app.listen(config.port);
  logger.log(`Backend listening on port ${String(config.port)}`, 'Bootstrap');
}

bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown bootstrap error';
  process.stderr.write(`Fatal bootstrap error: ${message}\n`);
  process.exitCode = 1;
});

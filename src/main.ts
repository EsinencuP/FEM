import { Logger } from 'nestjs-pino';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { ZodValidationPipe } from './common/pipes/zod-validation.pipe';
import { AppConfigService } from './config/app-config.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(AppConfigService);
  const logger = app.get(Logger);

  app.useLogger(logger);
  app.enableShutdownHooks();
  app.setGlobalPrefix(config.apiPrefix);
  app.useGlobalPipes(new ZodValidationPipe());

  const openApiConfig = new DocumentBuilder()
    .setTitle('National Equestrian Federation of Moldova API')
    .setDescription(
      'REST API for the information platform of the National Equestrian Federation of Moldova.',
    )
    .setVersion('1.0.0')
    .build();
  const openApiDocument = SwaggerModule.createDocument(app, openApiConfig);

  SwaggerModule.setup(`${config.apiPrefix}/docs`, app, openApiDocument, {
    jsonDocumentUrl: `${config.apiPrefix}/docs-json`,
  });

  await app.listen(config.port);
  logger.log(`Backend listening on port ${config.port}`, 'Bootstrap');
}

void bootstrap();

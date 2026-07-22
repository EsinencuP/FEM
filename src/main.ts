import { Logger } from 'nestjs-pino';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
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
  app.useGlobalFilters(new ApiExceptionFilter());

  const openApiConfig = new DocumentBuilder()
    .setTitle('National Equestrian Federation of Moldova API')
    .setDescription(
      'REST API for the information platform of the National Equestrian Federation of Moldova. Authentication is disabled for MVP development. Do not expose this API publicly without an access-control layer.',
    )
    .setVersion('1.0.0')
    .addTag('Countries')
    .addTag('Disciplines')
    .addTag('Clubs')
    .addTag('Owners')
    .addTag('Athletes')
    .addTag('Horses')
    .addTag('Competitions')
    .addTag('Competition Classes')
    .addTag('Results')
    .addTag('Public API')
    .build();
  const openApiDocument = SwaggerModule.createDocument(app, openApiConfig);

  SwaggerModule.setup(`${config.apiPrefix}/docs`, app, openApiDocument, {
    jsonDocumentUrl: `${config.apiPrefix}/docs-json`,
  });

  await app.listen(config.port);
  logger.log(`Backend listening on port ${String(config.port)}`, 'Bootstrap');
}

bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown bootstrap error';
  process.stderr.write(`Fatal bootstrap error: ${message}\n`);
  process.exitCode = 1;
});

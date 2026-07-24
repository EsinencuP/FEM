import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';

import { RequestAuditContext } from '../common/context/request-audit-context';
import { ApiExceptionFilter } from '../common/filters/api-exception.filter';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';

export const REQUEST_BODY_LIMIT = '100kb';

interface ExpressApplicationSettings {
  disable(setting: string): unknown;
  set(setting: string, value: unknown): unknown;
}

export interface HttpApplicationConfig {
  readonly isProduction: boolean;
  readonly corsAllowedOrigins: string[];
  readonly apiPrefix: string;
  readonly hstsEnabled: boolean;
  readonly trustProxyHops: number;
}

export function configureHttpApplication(
  app: NestExpressApplication,
  config: HttpApplicationConfig,
): void {
  app.use(
    helmet({
      strictTransportSecurity:
        config.isProduction && config.hstsEnabled
          ? { maxAge: 31_536_000, includeSubDomains: true, preload: false }
          : false,
    }),
  );
  app.use(cookieParser());
  app.use((request: Request, response: Response, next: NextFunction): void => {
    const incomingRequestId = request.headers['x-request-id'];
    const requestId =
      typeof incomingRequestId === 'string' && incomingRequestId.length <= 128
        ? incomingRequestId
        : randomUUID();
    request.headers['x-request-id'] = requestId;
    response.setHeader('x-request-id', requestId);
    RequestAuditContext.run(
      {
        requestId,
        method: request.method,
        path: request.originalUrl.split('?', 1)[0] ?? request.path,
      },
      next,
    );
  });
  app.useBodyParser('json', { limit: REQUEST_BODY_LIMIT });
  app.useBodyParser('urlencoded', { extended: true, limit: REQUEST_BODY_LIMIT });
  app.enableCors({
    origin: config.corsAllowedOrigins,
    credentials: true,
    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'If-None-Match',
      'Idempotency-Key',
      'If-Match',
      'X-Action-Reason',
      'X-Confirm-Action',
      'X-CSRF-Token',
      'X-Request-Id',
    ],
    exposedHeaders: [
      'Cache-Control',
      'Content-Language',
      'ETag',
      'Idempotency-Replayed',
      'Retry-After',
      'X-Request-Id',
    ],
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    maxAge: 600,
  });
  app.setGlobalPrefix(config.apiPrefix);
  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalFilters(new ApiExceptionFilter());
  const expressApp = app.getHttpAdapter().getInstance() as unknown as ExpressApplicationSettings;
  expressApp.disable('x-powered-by');
  if (config.trustProxyHops > 0) expressApp.set('trust proxy', config.trustProxyHops);
}

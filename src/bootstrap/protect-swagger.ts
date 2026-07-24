import { timingSafeEqual } from 'node:crypto';

import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';

export interface SwaggerProtectionConfig {
  readonly isProduction: boolean;
  readonly apiPrefix: string;
  readonly swaggerUsername: string | undefined;
  readonly swaggerPassword: string | undefined;
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function protectSwagger(
  app: NestExpressApplication,
  config: SwaggerProtectionConfig,
): void {
  if (!config.isProduction) return;
  const username = config.swaggerUsername;
  const password = config.swaggerPassword;
  if (!username || !password) throw new Error('Production Swagger credentials are missing');

  app.use(
    [`/${config.apiPrefix}/docs`, `/${config.apiPrefix}/docs-json`],
    (request: Request, response: Response, next: NextFunction): void => {
      const authorization = request.headers.authorization;
      const encoded = authorization?.startsWith('Basic ') ? authorization.slice(6) : '';
      let suppliedUsername = '';
      let suppliedPassword = '';
      try {
        const decoded = Buffer.from(encoded, 'base64').toString('utf8');
        const separator = decoded.indexOf(':');
        if (separator >= 0) {
          suppliedUsername = decoded.slice(0, separator);
          suppliedPassword = decoded.slice(separator + 1);
        }
      } catch {
        // The generic challenge below intentionally does not distinguish malformed input.
      }
      if (safeEqual(suppliedUsername, username) && safeEqual(suppliedPassword, password)) {
        next();
        return;
      }
      const requestId = response.getHeader('x-request-id');
      response.setHeader('WWW-Authenticate', 'Basic realm="FEM API documentation"');
      response.status(401).json({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Documentation credentials are required',
        code: 'DOCUMENTATION_AUTH_REQUIRED',
        details: [],
        timestamp: new Date().toISOString(),
        path: request.originalUrl,
        requestId: typeof requestId === 'string' ? requestId : 'unavailable',
      });
    },
  );
}

import { randomUUID } from 'node:crypto';

import { RequestMethod } from '@nestjs/common';
import type { Params } from 'nestjs-pino';

import type { AppConfigService } from './app-config.service';

const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.body.password',
  'req.body.passwordConfirmation',
  'req.body.currentPassword',
  'req.body.newPassword',
  'req.body.otp',
  'req.body.recoveryCode',
  'req.body.totpSecret',
  'req.headers.x-csrf-token',
  'req.body.token',
  'req.body.accessToken',
  'req.body.refreshToken',
  'res.headers["set-cookie"]',
];

export function createPinoConfig(config: AppConfigService): Params {
  return {
    forRoutes: [{ path: '/{*splat}', method: RequestMethod.ALL }],
    pinoHttp: {
      level: config.logLevel,
      redact: {
        paths: REDACTED_PATHS,
        censor: '[REDACTED]',
      },
      genReqId: (request, response): string => {
        const incomingRequestId = request.headers['x-request-id'];
        const requestId =
          typeof incomingRequestId === 'string' && incomingRequestId.length <= 128
            ? incomingRequestId
            : randomUUID();

        response.setHeader('x-request-id', requestId);
        return requestId;
      },
      customProps: (request) => ({ requestId: request.id }),
      customSuccessMessage: (request, response, responseTime): string =>
        `${request.method ?? 'UNKNOWN'} ${request.url ?? '/'} completed with ${String(response.statusCode)} in ${String(responseTime)}ms`,
      customErrorMessage: (request, response, error): string =>
        `${request.method ?? 'UNKNOWN'} ${request.url ?? '/'} failed with ${String(response.statusCode)}: ${error.message}`,
      ...(config.isProduction
        ? {}
        : {
            transport: {
              target: 'pino-pretty',
              options: {
                colorize: true,
                singleLine: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
              },
            },
          }),
    },
  };
}

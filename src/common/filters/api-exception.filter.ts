import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  type ExceptionFilter,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { IdempotentReplayException } from '../exceptions/idempotent-replay.exception';

interface ErrorBody {
  message?: string | string[];
  code?: string;
  details?: unknown[];
  error?: string;
}

interface NormalizedError {
  statusCode: number;
  error: string;
  message: string;
  code: string;
  details: unknown[];
}

interface ParserError {
  type?: unknown;
  status?: unknown;
  statusCode?: unknown;
}

const BAD_REQUEST_STATUS_CODE = 400;
const TRANSIENT_DATABASE_ERROR_CODES = new Set(['P1001', 'P1002', 'P1008', 'P1017', 'P2024']);

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    if (exception instanceof IdempotentReplayException) {
      response.setHeader('Idempotency-Replayed', 'true');
      response.status(exception.statusCode).json(exception.responseBody);
      return;
    }
    const normalized = this.normalize(exception);
    const responseRequestId = response.getHeader('x-request-id');
    const requestWithId = request as Request & { id?: unknown };
    const requestId =
      typeof responseRequestId === 'string'
        ? responseRequestId
        : typeof requestWithId.id === 'string'
          ? requestWithId.id
          : typeof request.headers['x-request-id'] === 'string'
            ? request.headers['x-request-id']
            : 'unavailable';

    response.status(normalized.statusCode).json({
      ...normalized,
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
      requestId,
    });
  }

  private normalize(exception: unknown): NormalizedError {
    const parserError = this.parserError(exception);
    if (parserError) return parserError;

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (TRANSIENT_DATABASE_ERROR_CODES.has(exception.code)) {
        return this.error(
          HttpStatus.SERVICE_UNAVAILABLE,
          'Service Unavailable',
          'Database is temporarily unavailable',
          'DATABASE_UNAVAILABLE',
        );
      }
      if (exception.code === 'P2034') {
        return this.error(
          HttpStatus.CONFLICT,
          'Conflict',
          'The operation conflicted with a concurrent update; retry the request',
          'CONCURRENT_WRITE_CONFLICT',
        );
      }
      if (exception.code === 'P2002') {
        return this.error(
          HttpStatus.CONFLICT,
          'Conflict',
          'A resource with these unique values already exists',
          'UNIQUE_CONFLICT',
        );
      }
      if (exception.code === 'P2003') {
        return this.error(
          HttpStatus.CONFLICT,
          'Conflict',
          'The operation conflicts with an existing relation',
          'RELATION_CONFLICT',
        );
      }
      if (exception.code === 'P2025') {
        return this.error(HttpStatus.NOT_FOUND, 'Not Found', 'Resource not found', 'NOT_FOUND');
      }
      if (exception.code === 'P2004') {
        return this.error(
          HttpStatus.BAD_REQUEST,
          'Bad Request',
          'The request violates a data constraint',
          'CONSTRAINT_VIOLATION',
        );
      }
    }

    if (
      exception instanceof Prisma.PrismaClientInitializationError ||
      exception instanceof Prisma.PrismaClientRustPanicError
    ) {
      return this.error(
        HttpStatus.SERVICE_UNAVAILABLE,
        'Service Unavailable',
        'Database is unavailable',
        'DATABASE_UNAVAILABLE',
      );
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      if (
        statusCode === BAD_REQUEST_STATUS_CODE &&
        (exception.cause instanceof SyntaxError || exception.message.toLowerCase().includes('json'))
      ) {
        return this.error(
          HttpStatus.BAD_REQUEST,
          'Bad Request',
          'Request body contains malformed JSON',
          'MALFORMED_JSON',
        );
      }
      const body = exception.getResponse();
      const objectBody = typeof body === 'object' ? (body as ErrorBody) : undefined;
      const rawMessage =
        objectBody?.message ?? (typeof body === 'string' ? body : exception.message);
      const message = Array.isArray(rawMessage) ? rawMessage.join('; ') : rawMessage;

      return {
        statusCode,
        error: objectBody?.error ?? this.statusLabel(statusCode),
        message,
        code: objectBody?.code ?? this.defaultCode(statusCode),
        details: objectBody?.details ?? [],
      };
    }

    return this.error(
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Internal Server Error',
      'An unexpected error occurred',
      'INTERNAL_ERROR',
    );
  }

  private error(statusCode: number, error: string, message: string, code: string): NormalizedError {
    return { statusCode, error, message, code, details: [] };
  }

  private statusLabel(statusCode: number): string {
    const label = HttpStatus[statusCode];
    return typeof label === 'string'
      ? label
          .toLowerCase()
          .split('_')
          .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
          .join(' ')
      : 'Error';
  }

  private defaultCode(statusCode: number): string {
    if (statusCode === 400) return 'VALIDATION_ERROR';
    if (statusCode === 404) return 'NOT_FOUND';
    if (statusCode === 409) return 'CONFLICT';
    return 'HTTP_ERROR';
  }

  private parserError(exception: unknown): NormalizedError | undefined {
    if (typeof exception !== 'object' || exception === null) return undefined;
    const candidate = exception as ParserError;
    if (
      candidate.type === 'entity.too.large' ||
      candidate.status === HttpStatus.PAYLOAD_TOO_LARGE ||
      candidate.statusCode === HttpStatus.PAYLOAD_TOO_LARGE
    ) {
      return this.error(
        HttpStatus.PAYLOAD_TOO_LARGE,
        'Payload Too Large',
        'Request body exceeds the allowed size',
        'PAYLOAD_TOO_LARGE',
      );
    }
    if (candidate.type === 'entity.parse.failed') {
      return this.error(
        HttpStatus.BAD_REQUEST,
        'Bad Request',
        'Request body contains malformed JSON',
        'MALFORMED_JSON',
      );
    }
    return undefined;
  }
}

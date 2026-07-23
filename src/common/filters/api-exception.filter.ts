import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  type ExceptionFilter,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

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

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const normalized = this.normalize(exception);

    response.status(normalized.statusCode).json({
      ...normalized,
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
    });
  }

  private normalize(exception: unknown): NormalizedError {
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
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
    return typeof label === 'string' ? label.replaceAll('_', ' ') : 'Error';
  }

  private defaultCode(statusCode: number): string {
    if (statusCode === 400) return 'VALIDATION_ERROR';
    if (statusCode === 404) return 'NOT_FOUND';
    if (statusCode === 409) return 'CONFLICT';
    return 'HTTP_ERROR';
  }
}

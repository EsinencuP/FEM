import { Prisma } from '@prisma/client';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';

import { ApiExceptionFilter } from './api-exception.filter';

interface TestResponse {
  getHeader(name: string): string | undefined;
  setHeader(name: string, value: string): TestResponse;
  status(value: number): TestResponse;
  json(value: unknown): TestResponse;
}

describe('ApiExceptionFilter', () => {
  const filter = new ApiExceptionFilter();

  function capture(error: unknown): {
    statusCode: number;
    body: unknown;
    headers: Record<string, string>;
  } {
    let statusCode = 0;
    let body: unknown;
    const headers: Record<string, string> = {
      'x-request-id': 'filter-test-request',
    };
    const response: TestResponse = {
      getHeader: (name: string): string | undefined => headers[name.toLowerCase()],
      setHeader: (name: string, value: string): TestResponse => {
        headers[name.toLowerCase()] = value;
        return response;
      },
      status: (value: number): TestResponse => {
        statusCode = value;
        return response;
      },
      json: (value: unknown): TestResponse => {
        body = value;
        return response;
      },
    };
    const request = { originalUrl: '/api/v1/filter-test', headers: {} };
    const host = new ExecutionContextHost([request, response]);
    host.setType('http');

    filter.catch(error, host);
    return { statusCode, body, headers };
  }

  it.each(['P1001', 'P1002', 'P1008', 'P1017', 'P2024'])(
    'maps transient Prisma error %s to a safe 503',
    (code) => {
      const error = new Prisma.PrismaClientKnownRequestError('sensitive database detail', {
        code,
        clientVersion: 'test',
      });

      expect(capture(error)).toMatchObject({
        statusCode: 503,
        body: {
          code: 'DATABASE_UNAVAILABLE',
          message: 'Database is temporarily unavailable',
          requestId: 'filter-test-request',
        },
        headers: {
          'cache-control': 'no-store',
        },
      });
    },
  );

  it('maps an exhausted serializable conflict to a retryable 409', () => {
    const error = new Prisma.PrismaClientKnownRequestError('write conflict', {
      code: 'P2034',
      clientVersion: 'test',
    });

    expect(capture(error)).toMatchObject({
      statusCode: 409,
      body: { code: 'CONCURRENT_WRITE_CONFLICT' },
    });
  });

  it('does not expose unknown exception details', () => {
    expect(capture(new Error('secret stack detail'))).toMatchObject({
      statusCode: 500,
      body: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  });
});

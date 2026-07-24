import type { Prisma } from '@prisma/client';

export class IdempotentReplayException extends Error {
  constructor(
    readonly statusCode: number,
    readonly responseBody: Prisma.JsonValue,
  ) {
    super('Idempotent response replay');
  }
}

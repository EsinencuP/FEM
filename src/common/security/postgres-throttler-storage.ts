import { Injectable } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';

import { withSerializableTransaction } from '../database/serializable-transaction';
import { PrismaService } from '../../database/prisma.service';

const STORAGE_TRANSACTION_ATTEMPTS = 8;

interface StorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

function secondsRemaining(deadline: Date | null, now: Date): number {
  if (!deadline) return 0;
  return Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / 1_000));
}

@Injectable()
export class PostgresThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly prisma: PrismaService) {}

  increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<StorageRecord> {
    return withSerializableTransaction(
      this.prisma,
      async (transaction) => {
        const now = new Date();
        const existing = await transaction.rateLimitBucket.findUnique({ where: { key } });
        if (
          !existing ||
          existing.expiresAt <= now ||
          (existing.blockedUntil !== null && existing.blockedUntil <= now)
        ) {
          const expiresAt = new Date(now.getTime() + ttl);
          await transaction.rateLimitBucket.upsert({
            where: { key },
            create: {
              key,
              throttlerName,
              windowStartedAt: now,
              expiresAt,
              totalHits: 1,
            },
            update: {
              throttlerName,
              windowStartedAt: now,
              expiresAt,
              totalHits: 1,
              blockedUntil: null,
            },
          });
          return {
            totalHits: 1,
            timeToExpire: secondsRemaining(expiresAt, now),
            isBlocked: false,
            timeToBlockExpire: 0,
          };
        }

        if (existing.blockedUntil) {
          return {
            totalHits: existing.totalHits,
            timeToExpire: secondsRemaining(existing.expiresAt, now),
            isBlocked: true,
            timeToBlockExpire: secondsRemaining(existing.blockedUntil, now),
          };
        }

        const totalHits = existing.totalHits + 1;
        const blockedUntil =
          totalHits > limit
            ? new Date(now.getTime() + Math.max(blockDuration, ttl))
            : null;
        await transaction.rateLimitBucket.update({
          where: { key },
          data: { totalHits, blockedUntil },
        });
        return {
          totalHits,
          timeToExpire: secondsRemaining(existing.expiresAt, now),
          isBlocked: blockedUntil !== null,
          timeToBlockExpire: secondsRemaining(blockedUntil, now),
        };
      },
      STORAGE_TRANSACTION_ATTEMPTS,
    );
  }
}

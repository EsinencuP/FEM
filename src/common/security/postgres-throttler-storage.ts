import { Injectable, Logger } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import { Prisma } from '@prisma/client';

import { hashToken } from './security-crypto';
import { PrismaService } from '../../database/prisma.service';

const EXPIRED_BUCKET_CLEANUP_INTERVAL = 128;
const EXPIRED_BUCKET_CLEANUP_BATCH = 500;

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
  private readonly logger = new Logger(PostgresThrottlerStorage.name);
  private operationsSinceCleanup = 0;

  constructor(private readonly prisma: PrismaService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<StorageRecord> {
    const storageKey = hashToken(`${throttlerName}:${key}`);
    this.operationsSinceCleanup += 1;
    const shouldCleanup = this.operationsSinceCleanup >= EXPIRED_BUCKET_CLEANUP_INTERVAL;
    if (shouldCleanup) this.operationsSinceCleanup = 0;
    if (shouldCleanup) await this.pruneExpiredBuckets();
    return this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${storageKey}, 0))::text AS "lock"`,
      );
      const now = new Date();
      const existing = await transaction.rateLimitBucket.findUnique({
        where: { key: storageKey },
      });
      if (existing?.blockedUntil && existing.blockedUntil > now) {
        return {
          totalHits: existing.totalHits,
          timeToExpire: secondsRemaining(existing.expiresAt, now),
          isBlocked: true,
          timeToBlockExpire: secondsRemaining(existing.blockedUntil, now),
        };
      }
      if (
        !existing ||
        existing.expiresAt <= now ||
        (existing.blockedUntil !== null && existing.blockedUntil <= now)
      ) {
        const expiresAt = new Date(now.getTime() + ttl);
        await transaction.rateLimitBucket.upsert({
          where: { key: storageKey },
          create: {
            key: storageKey,
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

      const totalHits = existing.totalHits + 1;
      const blockedUntil =
        totalHits > limit ? new Date(now.getTime() + Math.max(blockDuration, ttl)) : null;
      await transaction.rateLimitBucket.update({
        where: { key: storageKey },
        data: { totalHits, blockedUntil },
      });
      return {
        totalHits,
        timeToExpire: secondsRemaining(existing.expiresAt, now),
        isBlocked: blockedUntil !== null,
        timeToBlockExpire: secondsRemaining(blockedUntil, now),
      };
    });
  }

  private async pruneExpiredBuckets(): Promise<void> {
    try {
      const deleted = await this.prisma.$executeRaw(Prisma.sql`
        WITH expired AS (
          SELECT "key"
          FROM "RateLimitBucket"
          WHERE "expiresAt" <= CURRENT_TIMESTAMP
            AND ("blockedUntil" IS NULL OR "blockedUntil" <= CURRENT_TIMESTAMP)
          ORDER BY "expiresAt", "key"
          LIMIT ${EXPIRED_BUCKET_CLEANUP_BATCH}
          FOR UPDATE SKIP LOCKED
        )
        DELETE FROM "RateLimitBucket" bucket
        USING expired
        WHERE bucket."key" = expired."key"
      `);
      if (deleted > 0) this.logger.debug(`Pruned ${deleted} expired rate-limit buckets`);
    } catch {
      this.logger.warn('Expired rate-limit bucket cleanup failed; request processing continues');
    }
  }
}

import { ConflictException } from '@nestjs/common';
import { Prisma, type PrismaClient } from '@prisma/client';

import {
  RequestAuditContext,
  type RequestAuditState,
} from '../context/request-audit-context';
import { IdempotentReplayException } from '../exceptions/idempotent-replay.exception';
import { hashToken } from '../security/security-crypto';

const DEFAULT_MAX_ATTEMPTS = 3;
const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;
const ADMIN_ROUTE_PATTERN = /\/v1\/admin(?:\/|$)/;
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60_000;
const SENSITIVE_AUDIT_KEY =
  /password|authorization|cookie|csrf|token|secret|otp|recovery/i;

type SafeJson =
  | string
  | number
  | boolean
  | null
  | SafeJson[]
  | { [key: string]: SafeJson };

function safeJson(value: unknown, key = '', depth = 0): SafeJson {
  if (SENSITIVE_AUDIT_KEY.test(key)) return '[REDACTED]';
  if (depth >= 8) return '[TRUNCATED]';
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.slice(0, 4_000);
  if (typeof value === 'number') return Number.isFinite(value) ? value : String(value);
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value.slice(0, 100).map((entry) => safeJson(entry, '', depth + 1));
  }
  if (typeof value === 'object') {
    if (
      'toJSON' in value &&
      typeof (value as { toJSON?: unknown }).toJSON === 'function'
    ) {
      return safeJson((value as { toJSON(): unknown }).toJSON(), key, depth + 1);
    }
    const result: Record<string, SafeJson> = {};
    for (const [entryKey, entryValue] of Object.entries(value)) {
      result[entryKey] = safeJson(entryValue, entryKey, depth + 1);
    }
    return result;
  }
  if (typeof value === 'symbol') return value.description ?? '[SYMBOL]';
  if (typeof value === 'function') return '[FUNCTION]';
  return '[UNDEFINED]';
}

function safeJsonObject(value: unknown): Prisma.InputJsonObject {
  const json = safeJson(value);
  return typeof json === 'object' && json !== null && !Array.isArray(json)
    ? json
    : { value: json };
}

function responseEntityId(value: unknown): string | undefined {
  if (
    typeof value === 'object' &&
    value !== null &&
    'data' in value &&
    typeof value.data === 'object' &&
    value.data !== null &&
    'id' in value.data &&
    typeof value.data.id === 'string'
  ) {
    return value.data.id;
  }
  return undefined;
}

function responseData(value: unknown): unknown {
  if (typeof value === 'object' && value !== null && 'data' in value) {
    return value.data;
  }
  return undefined;
}

function adminEntityType(path: string): string {
  if (/\/athletes\/[^/]+\/clubs(?:\/|$)/.test(path)) return 'AthleteClubMembership';
  if (/\/(?:athletes\/[^/]+\/horses|horses\/[^/]+\/athletes)(?:\/|$)/.test(path)) {
    return 'AthleteHorseRelation';
  }
  if (/\/horses\/[^/]+\/owners(?:\/|$)/.test(path)) return 'HorseOwnership';
  if (/\/results\/[^/]+\/metrics(?:\/|$)/.test(path)) return 'ResultMetric';
  if (/\/identifiers(?:\/|$)/.test(path)) return 'ExternalIdentifier';
  const resource = path.split('/admin/')[1]?.split('/')[0] ?? 'Unknown';
  const names: Record<string, string> = {
    countries: 'Country',
    disciplines: 'Discipline',
    clubs: 'Club',
    owners: 'Owner',
    athletes: 'Athlete',
    horses: 'Horse',
    competitions: 'CompetitionEvent',
    'competition-classes': 'CompetitionClass',
    results: 'CompetitionResult',
  };
  return names[resource] ?? resource;
}

function adminMutationContext(): RequestAuditState | undefined {
  const context = RequestAuditContext.current();
  if (
    !context?.actorId ||
    !ADMIN_ROUTE_PATTERN.test(context.path) ||
    !['POST', 'PATCH', 'DELETE'].includes(context.method)
  ) {
    return undefined;
  }
  return context;
}

function idempotencyContext(): (RequestAuditState & {
  actorId: string;
  sessionId: string;
  idempotencyKey: string;
  requestHash: string;
}) | undefined {
  const context = adminMutationContext();
  if (
    context?.method !== 'POST' ||
    !context.actorId ||
    !context.sessionId ||
    !context.idempotencyKey ||
    !context.requestHash
  ) {
    return undefined;
  }
  return {
    ...context,
    actorId: context.actorId,
    sessionId: context.sessionId,
    idempotencyKey: context.idempotencyKey,
    requestHash: context.requestHash,
  };
}

async function readAuditSnapshot(
  transaction: Prisma.TransactionClient,
  context: RequestAuditState,
): Promise<SafeJson | undefined> {
  if (!['PATCH', 'DELETE'].includes(context.method)) return undefined;
  const entityId = (context.path.match(UUID_PATTERN) ?? []).at(-1);
  if (!entityId) return undefined;
  const entityType = adminEntityType(context.path);
  let value: unknown;
  switch (entityType) {
    case 'Country':
      value = await transaction.country.findUnique({ where: { id: entityId } });
      break;
    case 'Discipline':
      value = await transaction.discipline.findUnique({ where: { id: entityId } });
      break;
    case 'Club':
      value = await transaction.club.findUnique({ where: { id: entityId } });
      break;
    case 'Owner':
      value = await transaction.owner.findUnique({ where: { id: entityId } });
      break;
    case 'Athlete':
      value = await transaction.athlete.findUnique({ where: { id: entityId } });
      break;
    case 'Horse':
      value = await transaction.horse.findUnique({ where: { id: entityId } });
      break;
    case 'CompetitionEvent':
      value = await transaction.competitionEvent.findUnique({ where: { id: entityId } });
      break;
    case 'CompetitionClass':
      value = await transaction.competitionClass.findUnique({ where: { id: entityId } });
      break;
    case 'CompetitionResult':
      value = await transaction.competitionResult.findUnique({ where: { id: entityId } });
      break;
    case 'ResultMetric':
      value = await transaction.resultMetric.findUnique({ where: { id: entityId } });
      break;
    case 'ExternalIdentifier':
      value = await transaction.externalIdentifier.findUnique({ where: { id: entityId } });
      break;
    case 'AthleteClubMembership':
      value = await transaction.athleteClubMembership.findUnique({ where: { id: entityId } });
      break;
    case 'AthleteHorseRelation':
      value = await transaction.athleteHorseRelation.findUnique({ where: { id: entityId } });
      break;
    case 'HorseOwnership':
      value = await transaction.horseOwnership.findUnique({ where: { id: entityId } });
      break;
    default:
      return undefined;
  }
  return value === null || value === undefined ? undefined : safeJson(value);
}

async function claimExpectedVersion(
  transaction: Prisma.TransactionClient,
  context: RequestAuditState,
): Promise<void> {
  if (context.method !== 'PATCH' || context.expectedVersion === undefined) return;
  const entityId = (context.path.match(UUID_PATTERN) ?? []).at(-1);
  if (!entityId) return;
  const where = {
    id: entityId,
    ...(context.expectedVersion === '*' ? {} : { version: context.expectedVersion }),
  };
  const data = { version: { increment: 1 } };
  const entityType = adminEntityType(context.path);
  let count = 0;
  switch (entityType) {
    case 'Country':
      count = (await transaction.country.updateMany({ where, data })).count;
      break;
    case 'Discipline':
      count = (await transaction.discipline.updateMany({ where, data })).count;
      break;
    case 'Club':
      count = (await transaction.club.updateMany({ where, data })).count;
      break;
    case 'Owner':
      count = (await transaction.owner.updateMany({ where, data })).count;
      break;
    case 'Athlete':
      count = (await transaction.athlete.updateMany({ where, data })).count;
      break;
    case 'Horse':
      count = (await transaction.horse.updateMany({ where, data })).count;
      break;
    case 'CompetitionEvent':
      count = (await transaction.competitionEvent.updateMany({ where, data })).count;
      break;
    case 'CompetitionClass':
      count = (await transaction.competitionClass.updateMany({ where, data })).count;
      break;
    case 'CompetitionResult':
      count = (await transaction.competitionResult.updateMany({ where, data })).count;
      break;
    case 'ResultMetric':
      count = (await transaction.resultMetric.updateMany({ where, data })).count;
      break;
    case 'ExternalIdentifier':
      count = (await transaction.externalIdentifier.updateMany({ where, data })).count;
      break;
    case 'AthleteClubMembership':
      count = (await transaction.athleteClubMembership.updateMany({ where, data })).count;
      break;
    case 'AthleteHorseRelation':
      count = (await transaction.athleteHorseRelation.updateMany({ where, data })).count;
      break;
    case 'HorseOwnership':
      count = (await transaction.horseOwnership.updateMany({ where, data })).count;
      break;
    default:
      return;
  }
  if (count !== 1) {
    throw new ConflictException({
      message: 'The resource version is stale or the resource no longer exists',
      code: 'STALE_VERSION',
    });
  }
}

async function writeAtomicAdminAudit(
  transaction: Prisma.TransactionClient,
  result: unknown,
  oldData: SafeJson | undefined,
): Promise<void> {
  const context = adminMutationContext();
  if (!context) return;
  const actorId = context.actorId;
  if (!actorId) return;
  const pathIds = context.path.match(UUID_PATTERN) ?? [];
  const entityId = responseEntityId(result) ?? pathIds.at(-1);
  if (!entityId) throw new Error('Administrative mutation audit could not resolve entity id');
  const action = context.path.endsWith('/archive')
    ? 'ARCHIVE'
    : context.path.endsWith('/restore')
      ? 'RESTORE'
      : context.method === 'POST'
        ? 'CREATE'
        : context.method === 'DELETE'
          ? 'DELETE'
          : 'UPDATE';
  await transaction.auditLog.create({
    data: {
      actorId,
      ...(context.sessionId ? { sessionId: context.sessionId } : {}),
      action,
      entityType: adminEntityType(context.path),
      entityId,
      requestId: context.requestId,
      ...(oldData ? { oldData } : {}),
      newData: {
        route: context.path,
        method: context.method,
        payload: safeJson(responseData(result) ?? context.requestBody ?? null),
      },
      ...(context.reason ? { reason: context.reason } : {}),
    },
  });
}

export async function withSerializableTransaction<T>(
  prisma: PrismaClient,
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (transaction) => {
          const idempotency = idempotencyContext();
          const idempotencyId = idempotency
            ? hashToken(
                `${idempotency.actorId}\n${idempotency.method}\n${idempotency.path}\n${idempotency.idempotencyKey}`,
              )
            : undefined;
          if (idempotency && idempotencyId) {
            const existing = await transaction.idempotencyRecord.findUnique({
              where: { id: idempotencyId },
            });
            if (existing && existing.expiresAt > new Date()) {
              if (existing.requestHash !== idempotency.requestHash) {
                throw new ConflictException({
                  message: 'Idempotency-Key was already used with a different request payload',
                  code: 'IDEMPOTENCY_KEY_CONFLICT',
                });
              }
              throw new IdempotentReplayException(
                existing.responseStatus,
                existing.responseBody,
              );
            }
            if (existing) {
              await transaction.idempotencyRecord.delete({ where: { id: existing.id } });
            }
          }
          const context = adminMutationContext();
          const oldData = context
            ? await readAuditSnapshot(transaction, context)
            : undefined;
          if (context) await claimExpectedVersion(transaction, context);
          const result = await operation(transaction);
          await writeAtomicAdminAudit(transaction, result, oldData);
          if (idempotency && idempotencyId) {
            await transaction.idempotencyRecord.create({
              data: {
                id: idempotencyId,
                actorId: idempotency.actorId,
                sessionId: idempotency.sessionId,
                key: idempotency.idempotencyKey,
                method: idempotency.method,
                path: idempotency.path,
                requestHash: idempotency.requestHash,
                responseStatus: 201,
                responseBody: safeJsonObject(result),
                expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS),
              },
            });
          }
          return result;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );
    } catch (error: unknown) {
      const retryable =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2034' ||
          (error.code === 'P2002' && idempotencyContext() !== undefined));
      if (!retryable || attempt === maxAttempts) throw error;
    }
  }

  throw new Error('Serializable transaction retry loop exhausted unexpectedly');
}

import { BadRequestException, CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

import { AppConfigService } from '../../config/app-config.service';
import { RequestAuditContext } from '../../common/context/request-audit-context';
import { hashToken } from '../../common/security/security-crypto';
import { AuthService } from './auth.service';
import type { AuthenticatedRequest } from './auth.types';

function canonicalRequestValue(value: unknown): unknown {
  if (value === undefined) return null;
  if (Array.isArray(value)) return value.map(canonicalRequestValue);
  if (typeof value !== 'object' || value === null) return value;
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    result[key] = canonicalRequestValue((value as Record<string, unknown>)[key]);
  }
  return result;
}

@Injectable()
export class AdminSessionGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly config: AppConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const cookies = request.cookies as unknown;
    const cookieToken =
      typeof cookies === 'object' && cookies !== null
        ? (cookies as Record<string, unknown>)[this.config.authCookieName]
        : undefined;
    request.admin = await this.auth.authenticate(
      typeof cookieToken === 'string' ? cookieToken : undefined,
      {
        ...(typeof request.headers['x-request-id'] === 'string'
          ? { requestId: request.headers['x-request-id'] }
          : {}),
        ...(request.ip ? { ipAddress: request.ip } : {}),
        ...(typeof request.headers['user-agent'] === 'string'
          ? { userAgent: request.headers['user-agent'] }
          : {}),
      },
    );
    const reasonHeader = request.headers['x-action-reason'];
    const idempotencyHeader = request.headers['idempotency-key'];
    const idempotencyKey =
      typeof idempotencyHeader === 'string' && /^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyHeader)
        ? idempotencyHeader
        : undefined;
    const requestHash = idempotencyKey
      ? hashToken(JSON.stringify(canonicalRequestValue(request.body as unknown)))
      : undefined;
    const ifMatchHeader = request.headers['if-match'];
    const normalizedIfMatch =
      typeof ifMatchHeader === 'string'
        ? ifMatchHeader.trim().replace(/^W\//, '').replace(/^"|"$/g, '')
        : undefined;
    const expectedVersion =
      normalizedIfMatch === '*'
        ? '*'
        : normalizedIfMatch && /^[1-9]\d*$/.test(normalizedIfMatch)
          ? Number(normalizedIfMatch)
          : undefined;
    RequestAuditContext.setActor(
      request.admin.userId,
      request.admin.sessionId,
      request.body as unknown,
      typeof reasonHeader === 'string' ? reasonHeader.trim() : undefined,
      idempotencyKey,
      requestHash,
      expectedVersion,
    );
    return true;
  }
}

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true;
    const csrfHeader = request.headers['x-csrf-token'];
    if (!request.admin) return false;
    this.auth.assertCsrf(request.admin, typeof csrfHeader === 'string' ? csrfHeader : undefined);
    if (
      request.method === 'POST' &&
      /\/v1\/admin(?:\/|$)/.test(request.originalUrl) &&
      (!RequestAuditContext.current()?.idempotencyKey ||
        !RequestAuditContext.current()?.requestHash)
    ) {
      throw new BadRequestException({
        message: 'Administrative POST requests require an Idempotency-Key (8-128 safe characters)',
        code: 'IDEMPOTENCY_KEY_REQUIRED',
      });
    }
    if (
      request.method === 'PATCH' &&
      /\/v1\/admin(?:\/|$)/.test(request.originalUrl) &&
      RequestAuditContext.current()?.expectedVersion === undefined
    ) {
      throw new BadRequestException({
        message: 'Administrative PATCH requests require If-Match with a positive version',
        code: 'VERSION_PRECONDITION_REQUIRED',
      });
    }
    const isCritical =
      request.method === 'DELETE' ||
      /\/(?:archive|restore|publish|withdraw)(?:\?|$)/.test(request.originalUrl) ||
      RequestAuditContext.current()?.expectedVersion === '*';
    if (isCritical) {
      const confirmation = request.headers['x-confirm-action'];
      const reason = request.headers['x-action-reason'];
      if (
        confirmation !== 'true' ||
        typeof reason !== 'string' ||
        reason.trim().length < 3 ||
        reason.trim().length > 500
      ) {
        throw new BadRequestException({
          message:
            'Critical actions require X-Confirm-Action: true and X-Action-Reason (3-500 characters)',
          code: 'ACTION_CONFIRMATION_REQUIRED',
        });
      }
    }
    return true;
  }
}

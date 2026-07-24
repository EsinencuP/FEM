import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { REQUIRED_PERMISSIONS } from '../../common/decorators/require-permissions.decorator';
import { RequestAuditContext } from '../../common/context/request-audit-context';
import type { AuthenticatedRequest } from './auth.types';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (request.admin?.secondFactorMethod === 'RECOVERY') {
      const allowed =
        (request.method === 'GET' && request.path.endsWith('/v1/auth/me')) ||
        (request.method === 'POST' &&
          /\/v1\/auth\/(?:logout|totp\/re-enrollment(?:\/confirm)?)$/.test(request.path));
      if (!allowed) {
        throw new ForbiddenException({
          message: 'Recovery sessions must complete TOTP re-enrollment before Admin access',
          code: 'RECOVERY_SESSION_RESTRICTED',
        });
      }
    }
    const explicit =
      this.reflector.getAllAndOverride<string[] | undefined>(REQUIRED_PERMISSIONS, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    const required =
      explicit.length > 0
        ? explicit
        : /\/v1\/admin(?:\/|$)/.test(request.originalUrl)
          ? [request.method === 'GET' || request.method === 'HEAD' ? 'ADMIN_READ' : 'ADMIN_WRITE']
          : ['SECURITY_SELF'];
    if (!request.admin || required.some((code) => !request.admin?.permissions.includes(code))) {
      throw new ForbiddenException({
        message: 'The administrator does not have the required permission',
        code: 'PERMISSION_DENIED',
      });
    }
    if (
      RequestAuditContext.current()?.expectedVersion === '*' &&
      !request.admin.permissions.includes('VERSION_OVERRIDE')
    ) {
      throw new ForbiddenException({
        message: 'The administrator cannot override optimistic concurrency',
        code: 'VERSION_OVERRIDE_DENIED',
      });
    }
    return true;
  }
}

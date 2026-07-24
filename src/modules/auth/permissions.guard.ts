import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import {
  REQUIRED_PERMISSIONS,
} from '../../common/decorators/require-permissions.decorator';
import type { AuthenticatedRequest } from './auth.types';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
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
    return true;
  }
}

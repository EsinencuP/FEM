import { ForbiddenException, CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

import { AppConfigService } from '../../config/app-config.service';

@Injectable()
export class PortfolioReadonlyGuard implements CanActivate {
  constructor(private readonly config: AppConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    if (!this.config.portfolioReadonlyMode) return true;
    const request = context.switchToHttp().getRequest<{ method?: string; originalUrl?: string }>();
    const path = request.originalUrl ?? '';
    const method = request.method ?? 'GET';
    const adminMutation =
      /\/v1\/admin(?:\/|$)/u.test(path) && !['GET', 'HEAD', 'OPTIONS'].includes(method);
    const authMutation =
      /\/v1\/auth\/(?:password|recovery-codes|totp\/re-enrollment)(?:\/|$)/u.test(path) &&
      !['GET', 'HEAD', 'OPTIONS'].includes(method);
    if (adminMutation || authMutation) {
      throw new ForbiddenException({
        message: 'This portfolio is read-only.',
        code: 'PORTFOLIO_READ_ONLY',
      });
    }
    return true;
  }
}

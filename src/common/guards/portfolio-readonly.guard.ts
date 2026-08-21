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
    if (/\/v1\/admin(?:\/|$)/u.test(path) && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      throw new ForbiddenException({
        message: 'This portfolio is read-only.',
        code: 'PORTFOLIO_READ_ONLY',
      });
    }
    return true;
  }
}

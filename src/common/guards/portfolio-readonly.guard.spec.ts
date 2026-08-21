import { ForbiddenException } from '@nestjs/common';

import { PortfolioReadonlyGuard } from './portfolio-readonly.guard';

function context(method: string, originalUrl: string) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ method, originalUrl }) }),
  } as never;
}

describe('PortfolioReadonlyGuard', () => {
  it('allows reads and blocks admin mutations in portfolio mode', () => {
    const guard = new PortfolioReadonlyGuard({ portfolioReadonlyMode: true } as never);
    expect(guard.canActivate(context('GET', '/api/v1/admin/athletes'))).toBe(true);
    expect(() => guard.canActivate(context('POST', '/api/v1/admin/athletes'))).toThrow(
      ForbiddenException,
    );
  });

  it('blocks credential mutations but keeps logout available', () => {
    const guard = new PortfolioReadonlyGuard({ portfolioReadonlyMode: true } as never);
    expect(() => guard.canActivate(context('POST', '/api/v1/auth/password'))).toThrow(
      ForbiddenException,
    );
    expect(guard.canActivate(context('POST', '/api/v1/auth/logout'))).toBe(true);
  });

  it('is inactive outside portfolio mode', () => {
    const guard = new PortfolioReadonlyGuard({ portfolioReadonlyMode: false } as never);
    expect(guard.canActivate(context('POST', '/api/v1/admin/athletes'))).toBe(true);
  });
});

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Environment } from './environment.schema';

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService<Environment, true>) {}

  get nodeEnv(): Environment['NODE_ENV'] {
    return this.configService.getOrThrow('NODE_ENV', { infer: true });
  }

  get port(): number {
    return this.configService.getOrThrow('PORT', { infer: true });
  }

  get databaseUrl(): string {
    return this.configService.getOrThrow('DATABASE_URL', { infer: true });
  }

  get logLevel(): Environment['LOG_LEVEL'] {
    return this.configService.getOrThrow('LOG_LEVEL', { infer: true });
  }

  get apiPrefix(): string {
    return this.configService.getOrThrow('API_PREFIX', { infer: true });
  }

  get corsAllowedOrigins(): string[] {
    return this.configService
      .getOrThrow('CORS_ALLOWED_ORIGINS', { infer: true })
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  get authEncryptionKey(): Buffer {
    const value = this.configService.getOrThrow('AUTH_ENCRYPTION_KEY', {
      infer: true,
    });
    return Buffer.from(value, 'hex');
  }

  get authCookieName(): string {
    return this.configService.getOrThrow('AUTH_COOKIE_NAME', { infer: true });
  }

  get authSessionTtlMinutes(): number {
    return this.configService.getOrThrow('AUTH_SESSION_TTL_MINUTES', { infer: true });
  }

  get authSessionIdleMinutes(): number {
    return this.configService.getOrThrow('AUTH_SESSION_IDLE_MINUTES', { infer: true });
  }

  get authMaxFailedAttempts(): number {
    return this.configService.getOrThrow('AUTH_MAX_FAILED_ATTEMPTS', { infer: true });
  }

  get authLockoutMinutes(): number {
    return this.configService.getOrThrow('AUTH_LOCKOUT_MINUTES', { infer: true });
  }

  get hstsEnabled(): boolean {
    return this.configService.getOrThrow('HSTS_ENABLED', { infer: true });
  }

  get trustProxyHops(): number {
    return this.configService.getOrThrow('TRUST_PROXY_HOPS', { infer: true });
  }

  get rateLimitDefaultPerMinute(): number {
    return this.configService.getOrThrow('RATE_LIMIT_DEFAULT_PER_MINUTE', { infer: true });
  }

  get rateLimitAuthPerMinute(): number {
    return this.configService.getOrThrow('RATE_LIMIT_AUTH_PER_MINUTE', { infer: true });
  }

  get rateLimitAdminPerMinute(): number {
    return this.configService.getOrThrow('RATE_LIMIT_ADMIN_PER_MINUTE', { infer: true });
  }

  get rateLimitPublicPerMinute(): number {
    return this.configService.getOrThrow('RATE_LIMIT_PUBLIC_PER_MINUTE', { infer: true });
  }

  get rateLimitSearchPerMinute(): number {
    return this.configService.getOrThrow('RATE_LIMIT_SEARCH_PER_MINUTE', { infer: true });
  }

  get rateLimitFilesPerMinute(): number {
    return this.configService.getOrThrow('RATE_LIMIT_FILES_PER_MINUTE', { infer: true });
  }

  get rateLimitIntegrationsPerMinute(): number {
    return this.configService.getOrThrow('RATE_LIMIT_INTEGRATIONS_PER_MINUTE', {
      infer: true,
    });
  }

  get swaggerEnabled(): boolean {
    return this.configService.getOrThrow('SWAGGER_ENABLED', { infer: true });
  }

  get swaggerUsername(): string | undefined {
    return this.configService.get('SWAGGER_USERNAME', { infer: true });
  }

  get swaggerPassword(): string | undefined {
    return this.configService.get('SWAGGER_PASSWORD', { infer: true });
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get portfolioReadonlyMode(): boolean {
    return this.configService.getOrThrow('PORTFOLIO_READONLY_MODE', { infer: true });
  }

  get portfolioDemoUsername(): string {
    return this.configService.getOrThrow('PORTFOLIO_DEMO_USERNAME', { infer: true });
  }

  get portfolioDemoEmail(): string {
    return this.configService.getOrThrow('PORTFOLIO_DEMO_EMAIL', { infer: true }).toLowerCase();
  }

  get portfolioDemoPassword(): string {
    return this.configService.getOrThrow('PORTFOLIO_DEMO_PASSWORD', { infer: true });
  }
}

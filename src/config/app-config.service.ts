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

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }
}

import { type ExecutionContext, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule, ThrottlerStorage } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { AppConfigModule } from './config/app-config.module';
import { createPinoConfig } from './config/pino.config';
import { AppConfigService } from './config/app-config.service';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { AthletesModule } from './modules/athletes/athletes.module';
import { ClubsModule } from './modules/clubs/clubs.module';
import { CompetitionClassesModule } from './modules/competition-classes/competition-classes.module';
import { CompetitionResultsModule } from './modules/competition-results/competition-results.module';
import { CompetitionsModule } from './modules/competitions/competitions.module';
import { CountriesModule } from './modules/countries/countries.module';
import { DisciplinesModule } from './modules/disciplines/disciplines.module';
import { HorsesModule } from './modules/horses/horses.module';
import { OwnersModule } from './modules/owners/owners.module';
import { AuthModule } from './modules/auth/auth.module';
import { PostgresThrottlerStorage } from './common/security/postgres-throttler-storage';
import { AuditModule } from './modules/audit/audit.module';
import { PublicApiModule } from './modules/public-api/public-api.module';
import { PortfolioReadonlyGuard } from './common/guards/portfolio-readonly.guard';

function requestPath(context: ExecutionContext): string {
  const request = context.switchToHttp().getRequest<{ originalUrl?: unknown }>();
  return typeof request.originalUrl === 'string' ? request.originalUrl : '';
}

function isPublicSearchRequest(context: ExecutionContext): boolean {
  const originalUrl = requestPath(context);
  if (!/\/v1\/public\/(?:ro|ru)(?:\/|$)/u.test(originalUrl)) return false;
  if (/\/v1\/public\/(?:ro|ru)\/search(?:\/|\?|$)/u.test(originalUrl)) return true;
  const queryStart = originalUrl.indexOf('?');
  if (queryStart < 0) return false;
  return new URLSearchParams(originalUrl.slice(queryStart + 1)).has('search');
}

@Module({
  imports: [
    AppConfigModule,
    LoggerModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: createPinoConfig,
    }),
    ThrottlerModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: 60_000,
            limit: config.rateLimitDefaultPerMinute,
            skipIf: (context: ExecutionContext): boolean =>
              /\/v1\/(?:admin|public|integration)(?:\/|$)/.test(requestPath(context)),
          },
          {
            name: 'auth',
            ttl: 60_000,
            limit: config.rateLimitAuthPerMinute,
            skipIf: (context: ExecutionContext): boolean =>
              !/\/v1\/auth\/login(?:\?|$)/.test(requestPath(context)),
          },
          {
            name: 'admin',
            ttl: 60_000,
            limit: config.rateLimitAdminPerMinute,
            skipIf: (context: ExecutionContext): boolean =>
              !/\/v1\/admin(?:\/|$)/.test(requestPath(context)),
          },
          {
            name: 'public',
            ttl: 60_000,
            limit: config.rateLimitPublicPerMinute,
            skipIf: (context: ExecutionContext): boolean =>
              !/\/v1\/public(?:\/|$)/.test(requestPath(context)),
          },
          {
            name: 'search',
            ttl: 60_000,
            limit: config.rateLimitSearchPerMinute,
            skipIf: (context: ExecutionContext): boolean => !isPublicSearchRequest(context),
          },
          {
            name: 'files',
            ttl: 60_000,
            limit: config.rateLimitFilesPerMinute,
            skipIf: (context: ExecutionContext): boolean =>
              !/\/v1\/(?:admin\/(?:media|documents)|public\/(?:ro|ru)\/(?:media|documents))(?:\/|$)/.test(
                requestPath(context),
              ),
          },
          {
            name: 'integrations',
            ttl: 60_000,
            limit: config.rateLimitIntegrationsPerMinute,
            skipIf: (context: ExecutionContext): boolean =>
              !/\/v1\/integration(?:\/|$)/.test(requestPath(context)),
          },
        ],
      }),
    }),
    DatabaseModule,
    HealthModule,
    AuthModule,
    AuditModule,
    CountriesModule,
    DisciplinesModule,
    ClubsModule,
    OwnersModule,
    AthletesModule,
    HorsesModule,
    CompetitionsModule,
    CompetitionClassesModule,
    CompetitionResultsModule,
    PublicApiModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: PortfolioReadonlyGuard },
    PostgresThrottlerStorage,
    { provide: ThrottlerStorage, useExisting: PostgresThrottlerStorage },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}

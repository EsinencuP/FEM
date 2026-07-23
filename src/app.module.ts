import { Module } from '@nestjs/common';
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

@Module({
  imports: [
    AppConfigModule,
    LoggerModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: createPinoConfig,
    }),
    DatabaseModule,
    HealthModule,
    CountriesModule,
    DisciplinesModule,
    ClubsModule,
    OwnersModule,
    AthletesModule,
    HorsesModule,
    CompetitionsModule,
    CompetitionClassesModule,
    CompetitionResultsModule,
  ],
})
export class AppModule {}

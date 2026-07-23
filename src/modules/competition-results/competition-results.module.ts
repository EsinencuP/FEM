import { Module } from '@nestjs/common';

import { CompetitionResultsController } from './competition-results.controller';
import { CompetitionResultsService } from './competition-results.service';

@Module({
  controllers: [CompetitionResultsController],
  providers: [CompetitionResultsService],
  exports: [CompetitionResultsService],
})
export class CompetitionResultsModule {}

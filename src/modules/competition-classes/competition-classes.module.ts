import { Module } from '@nestjs/common';

import { CompetitionClassesController } from './competition-classes.controller';
import { CompetitionClassesService } from './competition-classes.service';

@Module({
  controllers: [CompetitionClassesController],
  providers: [CompetitionClassesService],
  exports: [CompetitionClassesService],
})
export class CompetitionClassesModule {}

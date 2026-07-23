import { Module } from '@nestjs/common';

import { ExternalIdentifiersModule } from '../external-identifiers/external-identifiers.module';
import { HorsesController } from './horses.controller';
import { HorsesService } from './horses.service';

@Module({
  imports: [ExternalIdentifiersModule],
  controllers: [HorsesController],
  providers: [HorsesService],
  exports: [HorsesService],
})
export class HorsesModule {}

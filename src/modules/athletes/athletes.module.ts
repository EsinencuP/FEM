import { Module } from '@nestjs/common';
import { ExternalIdentifiersModule } from '../external-identifiers/external-identifiers.module';
import { AthletesController } from './athletes.controller';
import { AthletesService } from './athletes.service';
@Module({
  imports: [ExternalIdentifiersModule],
  controllers: [AthletesController],
  providers: [AthletesService],
  exports: [AthletesService],
})
export class AthletesModule {}

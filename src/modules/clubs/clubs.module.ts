import { Module } from '@nestjs/common';
import { ExternalIdentifiersModule } from '../external-identifiers/external-identifiers.module';
import { ClubsController } from './clubs.controller';
import { ClubsService } from './clubs.service';
@Module({
  imports: [ExternalIdentifiersModule],
  controllers: [ClubsController],
  providers: [ClubsService],
  exports: [ClubsService],
})
export class ClubsModule {}

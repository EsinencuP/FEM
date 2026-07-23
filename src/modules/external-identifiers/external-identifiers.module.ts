import { Module } from '@nestjs/common';
import { ExternalIdentifiersService } from './external-identifiers.service';
@Module({ providers: [ExternalIdentifiersService], exports: [ExternalIdentifiersService] })
export class ExternalIdentifiersModule {}

import { Module } from '@nestjs/common';

import { PublicApiController } from './public-api.controller';
import { PublicApiService } from './public-api.service';
import { PublicCacheInterceptor } from './public-cache.interceptor';

@Module({
  controllers: [PublicApiController],
  providers: [PublicApiService, PublicCacheInterceptor],
})
export class PublicApiModule {}

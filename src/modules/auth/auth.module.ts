import { Global, Module } from '@nestjs/common';

import { AdminSessionGuard, CsrfGuard } from './admin-session.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, AdminSessionGuard, CsrfGuard],
  exports: [AuthService, AdminSessionGuard, CsrfGuard],
})
export class AuthModule {}

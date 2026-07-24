import { Global, Module } from '@nestjs/common';

import { AdminSessionGuard, CsrfGuard } from './admin-session.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PermissionsGuard } from './permissions.guard';

@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, AdminSessionGuard, PermissionsGuard, CsrfGuard],
  exports: [AuthService, AdminSessionGuard, PermissionsGuard, CsrfGuard],
})
export class AuthModule {}

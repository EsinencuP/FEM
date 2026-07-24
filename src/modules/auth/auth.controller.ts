import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { AdminProtected } from '../../common/decorators/admin-protected.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { ApiStandardErrors } from '../../common/decorators/api-contract.decorator';
import { AppConfigService } from '../../config/app-config.service';
import { AuthService } from './auth.service';
import type { AuthenticatedRequest, RequestSecurityMetadata } from './auth.types';
import {
  ChangePasswordDto,
  ConfirmTotpReenrollmentDto,
  LoginDto,
  RotateRecoveryCodesDto,
  StartTotpReenrollmentDto,
} from './dto/auth.dto';

@ApiTags('Authentication')
@ApiStandardErrors()
@RequirePermissions('SECURITY_SELF')
@Controller('v1/auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: AppConfigService,
  ) {}

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Create an ADMIN session using password and a second factor' })
  @ApiOkResponse({ description: 'Session created; CSRF token is returned once in the body' })
  @ApiTooManyRequestsResponse({ description: 'Too many authentication attempts' })
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<Awaited<ReturnType<AuthService['login']>>['response']> {
    const result = await this.auth.login(dto, this.metadata(request));
    response.cookie(this.config.authCookieName, result.cookieToken, this.cookieOptions());
    return result.response;
  }

  @Post('refresh')
  @HttpCode(200)
  @AdminProtected()
  @ApiOperation({ summary: 'Rotate the opaque session and CSRF tokens' })
  @ApiOkResponse({ description: 'Session token rotated; a new CSRF token is returned once' })
  async refresh(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<Awaited<ReturnType<AuthService['refreshSession']>>['response']> {
    const result = await this.auth.refreshSession(
      this.requireAdmin(request),
      this.metadata(request),
    );
    response.cookie(this.config.authCookieName, result.cookieToken, this.cookieOptions());
    return result.response;
  }

  @Get('me')
  @AdminProtected()
  @ApiOperation({ summary: 'Get the current ADMIN identity and session' })
  me(@Req() request: AuthenticatedRequest): ReturnType<AuthService['me']> {
    return this.auth.me(this.requireAdmin(request));
  }

  @Get('sessions')
  @AdminProtected()
  @ApiOperation({ summary: 'List current and revoked sessions for the signed-in administrator' })
  sessions(@Req() request: AuthenticatedRequest): ReturnType<AuthService['listSessions']> {
    return this.auth.listSessions(this.requireAdmin(request));
  }

  @Post('logout')
  @HttpCode(204)
  @AdminProtected()
  @ApiOperation({ summary: 'Revoke the current ADMIN session' })
  @ApiNoContentResponse()
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logout(this.requireAdmin(request), this.metadata(request));
    response.clearCookie(this.config.authCookieName, this.cookieOptions());
  }

  @Delete('sessions/:sessionId')
  @HttpCode(204)
  @AdminProtected()
  @ApiOperation({ summary: 'Revoke one of the current administrator sessions' })
  @ApiNoContentResponse()
  revokeSession(
    @Param('sessionId', new ParseUUIDPipe({ version: '4' })) sessionId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    return this.auth.revokeSession(
      this.requireAdmin(request),
      sessionId,
      this.metadata(request),
    );
  }

  @Post('password')
  @HttpCode(204)
  @AdminProtected()
  @ApiOperation({ summary: 'Change password and revoke other sessions' })
  @ApiNoContentResponse()
  changePassword(
    @Body() dto: ChangePasswordDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    return this.auth.changePassword(this.requireAdmin(request), dto, this.metadata(request));
  }

  @Post('recovery-codes')
  @HttpCode(200)
  @AdminProtected()
  @ApiOperation({ summary: 'Rotate and return one-time 2FA recovery codes' })
  @ApiOkResponse({ description: 'New recovery codes; each value is returned only once' })
  recoveryCodes(
    @Body() dto: RotateRecoveryCodesDto,
    @Req() request: AuthenticatedRequest,
  ): ReturnType<AuthService['rotateRecoveryCodes']> {
    return this.auth.rotateRecoveryCodes(
      this.requireAdmin(request),
      dto,
      this.metadata(request),
    );
  }

  @Post('totp/re-enrollment')
  @HttpCode(200)
  @AdminProtected()
  @ApiOperation({ summary: 'Start TOTP re-enrollment from a recovery-code session' })
  @ApiOkResponse({ description: 'One-time TOTP secret and challenge expiry' })
  startTotpReenrollment(
    @Body() dto: StartTotpReenrollmentDto,
    @Req() request: AuthenticatedRequest,
  ): ReturnType<AuthService['startTotpReenrollment']> {
    return this.auth.startTotpReenrollment(
      this.requireAdmin(request),
      dto,
      this.metadata(request),
    );
  }

  @Post('totp/re-enrollment/confirm')
  @HttpCode(200)
  @AdminProtected()
  @ApiOperation({ summary: 'Confirm a new TOTP factor and rotate recovery codes' })
  @ApiOkResponse({ description: 'TOTP factor replaced and new one-time recovery codes returned' })
  confirmTotpReenrollment(
    @Body() dto: ConfirmTotpReenrollmentDto,
    @Req() request: AuthenticatedRequest,
  ): ReturnType<AuthService['confirmTotpReenrollment']> {
    return this.auth.confirmTotpReenrollment(
      this.requireAdmin(request),
      dto,
      this.metadata(request),
    );
  }

  private cookieOptions(): {
    httpOnly: true;
    secure: boolean;
    sameSite: 'strict';
    path: string;
    maxAge: number;
  } {
    return {
      httpOnly: true,
      secure: this.config.isProduction,
      sameSite: 'strict',
      path: `/${this.config.apiPrefix}/v1`,
      maxAge: this.config.authSessionTtlMinutes * 60_000,
    };
  }

  private requireAdmin(request: AuthenticatedRequest): NonNullable<AuthenticatedRequest['admin']> {
    if (!request.admin) throw new Error('AdminSessionGuard did not attach a principal');
    return request.admin;
  }

  private metadata(request: Request): RequestSecurityMetadata {
    const requestId = request.headers['x-request-id'];
    const userAgent = request.headers['user-agent'];
    return {
      ...(typeof requestId === 'string' ? { requestId } : {}),
      ...(request.ip ? { ipAddress: request.ip } : {}),
      ...(typeof userAgent === 'string' ? { userAgent } : {}),
    };
  }
}

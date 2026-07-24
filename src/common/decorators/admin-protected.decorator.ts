import { applyDecorators, UseGuards } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiHeader,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { ApiErrorDto } from '../dto/api-error.dto';
import { AdminSessionGuard, CsrfGuard } from '../../modules/auth/admin-session.guard';
import { PermissionsGuard } from '../../modules/auth/permissions.guard';

export function AdminProtected(): ClassDecorator & MethodDecorator {
  return applyDecorators(
    UseGuards(AdminSessionGuard, PermissionsGuard, CsrfGuard),
    ApiCookieAuth('adminSession'),
    ApiHeader({
      name: 'X-CSRF-Token',
      required: false,
      description: 'Required for POST, PATCH and DELETE requests; returned by login',
    }),
    ApiHeader({
      name: 'If-Match',
      required: false,
      description:
        'Required positive resource version for PATCH; * additionally requires VERSION_OVERRIDE, confirmation and reason',
    }),
    ApiHeader({
      name: 'Idempotency-Key',
      required: false,
      description: 'Required for every administrative POST; replay-safe for 24 hours',
    }),
    ApiHeader({
      name: 'X-Confirm-Action',
      required: false,
      description: 'Set to true for archive, restore and DELETE operations',
    }),
    ApiHeader({
      name: 'X-Action-Reason',
      required: false,
      description: 'Required reason (3-500 characters) for critical operations',
    }),
    ApiUnauthorizedResponse({ type: ApiErrorDto, description: 'Administrator session required' }),
    ApiForbiddenResponse({
      type: ApiErrorDto,
      description: 'Required permission or CSRF token is missing',
    }),
  );
}

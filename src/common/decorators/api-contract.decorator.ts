import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiExtraModels,
  ApiNotFoundResponse,
  ApiPayloadTooLargeResponse,
  ApiServiceUnavailableResponse,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';

import { ApiErrorDto } from '../dto/api-error.dto';

export function ApiStandardErrors(): ClassDecorator & MethodDecorator {
  return applyDecorators(
    ApiExtraModels(ApiErrorDto),
    ApiBadRequestResponse({ type: ApiErrorDto, description: 'Request validation failed' }),
    ApiNotFoundResponse({ type: ApiErrorDto, description: 'Resource was not found' }),
    ApiConflictResponse({ type: ApiErrorDto, description: 'Unique or relation conflict' }),
    ApiPayloadTooLargeResponse({
      type: ApiErrorDto,
      description: 'Request body exceeds the configured size limit',
    }),
    ApiTooManyRequestsResponse({
      type: ApiErrorDto,
      description: 'Request rate limit exceeded',
    }),
    ApiServiceUnavailableResponse({ type: ApiErrorDto, description: 'Database is unavailable' }),
  );
}

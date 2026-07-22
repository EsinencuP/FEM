import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiExtraModels,
  ApiNotFoundResponse,
  ApiServiceUnavailableResponse,
} from '@nestjs/swagger';

import { ApiErrorDto } from '../dto/api-error.dto';

export function ApiStandardErrors(): MethodDecorator {
  return applyDecorators(
    ApiExtraModels(ApiErrorDto),
    ApiBadRequestResponse({ type: ApiErrorDto, description: 'Request validation failed' }),
    ApiNotFoundResponse({ type: ApiErrorDto, description: 'Resource was not found' }),
    ApiConflictResponse({ type: ApiErrorDto, description: 'Unique or relation conflict' }),
    ApiServiceUnavailableResponse({ type: ApiErrorDto, description: 'Database is unavailable' }),
  );
}

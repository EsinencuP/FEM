import { ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

import { paginationSchema } from '../../../common/pagination/pagination.dto';

export class AuditLogListQueryDto {
  static readonly schema = paginationSchema
    .extend({
      actorId: z.uuid().optional(),
      sessionId: z.uuid().optional(),
      entityType: z.string().trim().min(1).max(100).optional(),
      entityId: z.uuid().optional(),
      action: z.string().trim().min(1).max(100).optional(),
      requestId: z.string().trim().min(1).max(128).optional(),
      dateFrom: z.iso.datetime({ offset: true }).optional(),
      dateTo: z.iso.datetime({ offset: true }).optional(),
      sortOrder: z.enum(['asc', 'desc']).default('desc'),
    })
    .strict()
    .superRefine((value, context) => {
      if (value.dateFrom && value.dateTo && Date.parse(value.dateFrom) > Date.parse(value.dateTo)) {
        context.addIssue({
          code: 'custom',
          path: ['dateTo'],
          message: 'dateTo must not be earlier than dateFrom',
        });
      }
    });

  @ApiPropertyOptional({ type: 'integer', default: 1, minimum: 1 })
  page = 1;

  @ApiPropertyOptional({ type: 'integer', default: 20, minimum: 1, maximum: 100 })
  limit = 20;

  @ApiPropertyOptional({ format: 'uuid' })
  actorId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  sessionId?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  entityType?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  entityId?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  action?: string;

  @ApiPropertyOptional({ maxLength: 128 })
  requestId?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  dateFrom?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  dateTo?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  sortOrder: 'asc' | 'desc' = 'desc';
}

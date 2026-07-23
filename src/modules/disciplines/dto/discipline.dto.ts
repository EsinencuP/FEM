import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RecordStatus } from '@prisma/client';
import { z } from 'zod';

import {
  archivedSchema,
  recordStatusSchema,
  requiredString,
  sortOrderSchema,
} from '../../../common/dto/schemas';
import { paginationSchema } from '../../../common/pagination/pagination.dto';

export class CreateDisciplineDto {
  static readonly schema = z
    .object({
      code: requiredString(80),
      name: requiredString(160),
      description: z.string().trim().max(2000).nullable().optional(),
      status: recordStatusSchema.optional(),
    })
    .strict();

  @ApiProperty({ example: 'DEMO_JUMPING' }) code!: string;
  @ApiProperty({ example: 'Demo Jumping' }) name!: string;
  @ApiPropertyOptional({ nullable: true }) description?: string | null;
  @ApiPropertyOptional({ enum: RecordStatus, default: RecordStatus.DRAFT }) status?: RecordStatus;
}

export class UpdateDisciplineDto {
  static readonly schema = CreateDisciplineDto.schema.partial().strict();
  @ApiPropertyOptional() code?: string;
  @ApiPropertyOptional() name?: string;
  @ApiPropertyOptional({ nullable: true }) description?: string | null;
  @ApiPropertyOptional({ enum: RecordStatus }) status?: RecordStatus;
}

export class DisciplineListQueryDto {
  static readonly schema = paginationSchema
    .extend({
      search: z.string().trim().max(200).optional(),
      status: recordStatusSchema.optional(),
      archived: archivedSchema,
      sortBy: z.enum(['name', 'code', 'createdAt']).default('name'),
      sortOrder: sortOrderSchema,
    })
    .strict();
  @ApiPropertyOptional({ default: 1 }) page = 1;
  @ApiPropertyOptional({ default: 20, maximum: 100 }) limit = 20;
  @ApiPropertyOptional() search?: string;
  @ApiPropertyOptional({ enum: RecordStatus }) status?: RecordStatus;
  @ApiPropertyOptional({ enum: ['true', 'false', 'all'], default: 'false' }) archived:
    'true' | 'false' | 'all' = 'false';
  @ApiPropertyOptional({ enum: ['name', 'code', 'createdAt'], default: 'name' }) sortBy:
    'name' | 'code' | 'createdAt' = 'name';
  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' }) sortOrder: 'asc' | 'desc' = 'asc';
}

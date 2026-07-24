import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RecordStatus } from '@prisma/client';
import { z } from 'zod';

import {
  archivedSchema,
  dateStringSchema,
  nullableDateStringSchema,
  recordStatusSchema,
  requiredString,
  requireAtLeastOneField,
  sortOrderSchema,
  uuidSchema,
} from '../../../common/dto/schemas';
import { paginationSchema } from '../../../common/pagination/pagination.dto';

const fields = z
  .object({
    competitionEventId: uuidSchema,
    title: requiredString(240),
    disciplineId: uuidSchema,
    category: z.string().trim().max(160).nullable().optional(),
    level: z.string().trim().max(160).nullable().optional(),
    competitionDate: nullableDateStringSchema.optional(),
    sortOrder: z.coerce.number().int().min(0).max(100_000).optional(),
    status: recordStatusSchema.optional(),
  })
  .strict();

export class CreateCompetitionClassDto {
  static readonly schema = fields;
  @ApiProperty({ format: 'uuid' }) competitionEventId!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ format: 'uuid' }) disciplineId!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) category?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) level?: string | null;
  @ApiPropertyOptional({ type: String, format: 'date', nullable: true })
  competitionDate?: Date | null;
  @ApiPropertyOptional({ minimum: 0 }) sortOrder?: number;
  @ApiPropertyOptional({ enum: RecordStatus }) status?: RecordStatus;
}

export class UpdateCompetitionClassDto {
  static readonly schema = fields.partial().strict().superRefine(requireAtLeastOneField);
  @ApiPropertyOptional({ format: 'uuid' }) competitionEventId?: string;
  @ApiPropertyOptional() title?: string;
  @ApiPropertyOptional({ format: 'uuid' }) disciplineId?: string;
  @ApiPropertyOptional({ type: String, nullable: true }) category?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) level?: string | null;
  @ApiPropertyOptional({ type: String, format: 'date', nullable: true })
  competitionDate?: Date | null;
  @ApiPropertyOptional({ minimum: 0 }) sortOrder?: number;
  @ApiPropertyOptional({ enum: RecordStatus }) status?: RecordStatus;
}

export class CompetitionClassListQueryDto {
  static readonly schema = paginationSchema
    .extend({
      competitionEventId: uuidSchema.optional(),
      disciplineId: uuidSchema.optional(),
      category: z.string().trim().max(160).optional(),
      level: z.string().trim().max(160).optional(),
      status: recordStatusSchema.optional(),
      competitionDate: dateStringSchema.optional(),
      archived: archivedSchema,
      sortBy: z.enum(['competitionDate', 'sortOrder', 'title', 'createdAt']).default('sortOrder'),
      sortOrder: sortOrderSchema,
    })
    .strict();
  @ApiPropertyOptional({ type: 'integer', default: 1, minimum: 1 }) page = 1;
  @ApiPropertyOptional({ type: 'integer', default: 20, minimum: 1, maximum: 100 })
  limit = 20;
  @ApiPropertyOptional({ type: String, format: 'uuid' }) competitionEventId?: string;
  @ApiPropertyOptional({ type: String, format: 'uuid' }) disciplineId?: string;
  @ApiPropertyOptional() category?: string;
  @ApiPropertyOptional() level?: string;
  @ApiPropertyOptional({ enum: RecordStatus }) status?: RecordStatus;
  @ApiPropertyOptional({ type: String, format: 'date' }) competitionDate?: Date;
  @ApiPropertyOptional({ type: String, enum: ['true', 'false', 'all'], default: 'false' })
  archived: 'true' | 'false' | 'all' = 'false';
  @ApiPropertyOptional({
    type: String,
    enum: ['competitionDate', 'sortOrder', 'title', 'createdAt'],
    default: 'sortOrder',
  })
  sortBy: 'competitionDate' | 'sortOrder' | 'title' | 'createdAt' = 'sortOrder';
  @ApiPropertyOptional({ type: String, enum: ['asc', 'desc'], default: 'asc' })
  sortOrder: 'asc' | 'desc' = 'asc';
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PublicationStatus, RecordStatus } from '@prisma/client';
import { z } from 'zod';

import {
  archivedSchema,
  dateStringSchema,
  ensureDateOrder,
  publicationStatusSchema,
  queryBooleanSchema,
  recordStatusSchema,
  requiredString,
  requireAtLeastOneField,
  sortOrderSchema,
  uuidSchema,
} from '../../../common/dto/schemas';
import { paginationSchema } from '../../../common/pagination/pagination.dto';

const fields = z
  .object({
    title: requiredString(240),
    slug: z
      .string()
      .trim()
      .min(1)
      .max(240)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    description: z.string().trim().max(20_000).nullable().optional(),
    startDate: dateStringSchema,
    endDate: dateStringSchema,
    location: z.string().trim().max(240).nullable().optional(),
    venue: z.string().trim().max(240).nullable().optional(),
    countryId: uuidSchema.nullable().optional(),
    organizerName: z.string().trim().max(240).nullable().optional(),
    status: recordStatusSchema.optional(),
    coverMediaId: uuidSchema.nullable().optional(),
  })
  .strict();

export class CreateCompetitionDto {
  static readonly schema = fields.superRefine(ensureDateOrder);
  @ApiProperty() title!: string;
  @ApiProperty() slug!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) description?: string | null;
  @ApiProperty({ format: 'date' }) startDate!: Date;
  @ApiProperty({ format: 'date' }) endDate!: Date;
  @ApiPropertyOptional({ type: String, nullable: true }) location?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) venue?: string | null;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true }) countryId?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) organizerName?: string | null;
  @ApiPropertyOptional({ enum: RecordStatus }) status?: RecordStatus;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  coverMediaId?: string | null;
}

export class UpdateCompetitionDto {
  static readonly schema = fields
    .partial()
    .strict()
    .superRefine((value, context) => {
      requireAtLeastOneField(value, context);
      ensureDateOrder(value, context);
    });
  @ApiPropertyOptional() title?: string;
  @ApiPropertyOptional() slug?: string;
  @ApiPropertyOptional({ type: String, nullable: true }) description?: string | null;
  @ApiPropertyOptional({ type: String, format: 'date' }) startDate?: Date;
  @ApiPropertyOptional({ type: String, format: 'date' }) endDate?: Date;
  @ApiPropertyOptional({ type: String, nullable: true }) location?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) venue?: string | null;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true }) countryId?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) organizerName?: string | null;
  @ApiPropertyOptional({ enum: RecordStatus }) status?: RecordStatus;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  coverMediaId?: string | null;
}

export class CompetitionListQueryDto {
  static readonly schema = paginationSchema
    .extend({
      search: z.string().trim().max(200).optional(),
      countryId: uuidSchema.optional(),
      disciplineId: uuidSchema.optional(),
      status: recordStatusSchema.optional(),
      publicationStatus: publicationStatusSchema.optional(),
      dateFrom: dateStringSchema.optional(),
      dateTo: dateStringSchema.optional(),
      upcoming: queryBooleanSchema.optional(),
      archived: archivedSchema,
      sortBy: z.enum(['startDate', 'endDate', 'title', 'createdAt']).default('startDate'),
      sortOrder: sortOrderSchema,
    })
    .strict()
    .superRefine((value, context) => {
      ensureDateOrder({ startDate: value.dateFrom, endDate: value.dateTo }, context);
    });
  @ApiPropertyOptional({ type: 'integer', default: 1, minimum: 1 }) page = 1;
  @ApiPropertyOptional({ type: 'integer', default: 20, minimum: 1, maximum: 100 })
  limit = 20;
  @ApiPropertyOptional() search?: string;
  @ApiPropertyOptional({ type: String, format: 'uuid' }) countryId?: string;
  @ApiPropertyOptional({ type: String, format: 'uuid' }) disciplineId?: string;
  @ApiPropertyOptional({ enum: RecordStatus }) status?: RecordStatus;
  @ApiPropertyOptional({ enum: PublicationStatus }) publicationStatus?: PublicationStatus;
  @ApiPropertyOptional({ type: String, format: 'date' }) dateFrom?: Date;
  @ApiPropertyOptional({ type: String, format: 'date' }) dateTo?: Date;
  @ApiPropertyOptional({ type: Boolean }) upcoming?: boolean;
  @ApiPropertyOptional({ type: String, enum: ['true', 'false', 'all'], default: 'false' })
  archived: 'true' | 'false' | 'all' = 'false';
  @ApiPropertyOptional({
    type: String,
    enum: ['startDate', 'endDate', 'title', 'createdAt'],
    default: 'startDate',
  })
  sortBy: 'startDate' | 'endDate' | 'title' | 'createdAt' = 'startDate';
  @ApiPropertyOptional({ type: String, enum: ['asc', 'desc'], default: 'asc' })
  sortOrder: 'asc' | 'desc' = 'asc';
}

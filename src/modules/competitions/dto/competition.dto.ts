import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PublicationStatus, RecordStatus } from '@prisma/client';
import { z } from 'zod';

import {
  archivedSchema,
  dateStringSchema,
  ensureDateOrder,
  publicationStatusSchema,
  recordStatusSchema,
  requiredString,
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
    publicationStatus: publicationStatusSchema.optional(),
    coverMediaId: uuidSchema.nullable().optional(),
  })
  .strict();

export class CreateCompetitionDto {
  static readonly schema = fields.superRefine(ensureDateOrder);
  @ApiProperty() title!: string;
  @ApiProperty() slug!: string;
  @ApiPropertyOptional({ nullable: true }) description?: string | null;
  @ApiProperty({ format: 'date' }) startDate!: Date;
  @ApiProperty({ format: 'date' }) endDate!: Date;
  @ApiPropertyOptional({ nullable: true }) location?: string | null;
  @ApiPropertyOptional({ nullable: true }) venue?: string | null;
  @ApiPropertyOptional({ nullable: true }) countryId?: string | null;
  @ApiPropertyOptional({ nullable: true }) organizerName?: string | null;
  @ApiPropertyOptional({ enum: RecordStatus }) status?: RecordStatus;
  @ApiPropertyOptional({ enum: PublicationStatus }) publicationStatus?: PublicationStatus;
  @ApiPropertyOptional({ nullable: true }) coverMediaId?: string | null;
}

export class UpdateCompetitionDto {
  static readonly schema = fields.partial().strict().superRefine(ensureDateOrder);
  @ApiPropertyOptional() title?: string;
  @ApiPropertyOptional() slug?: string;
  @ApiPropertyOptional({ nullable: true }) description?: string | null;
  @ApiPropertyOptional() startDate?: Date;
  @ApiPropertyOptional() endDate?: Date;
  @ApiPropertyOptional({ nullable: true }) location?: string | null;
  @ApiPropertyOptional({ nullable: true }) venue?: string | null;
  @ApiPropertyOptional({ nullable: true }) countryId?: string | null;
  @ApiPropertyOptional({ nullable: true }) organizerName?: string | null;
  @ApiPropertyOptional({ enum: RecordStatus }) status?: RecordStatus;
  @ApiPropertyOptional({ enum: PublicationStatus }) publicationStatus?: PublicationStatus;
  @ApiPropertyOptional({ nullable: true }) coverMediaId?: string | null;
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
      upcoming: z.coerce.boolean().optional(),
      archived: archivedSchema,
      sortBy: z.enum(['startDate', 'endDate', 'title', 'createdAt']).default('startDate'),
      sortOrder: sortOrderSchema,
    })
    .strict()
    .superRefine((value, context) => {
      ensureDateOrder({ startDate: value.dateFrom, endDate: value.dateTo }, context);
    });
  @ApiPropertyOptional({ default: 1 }) page = 1;
  @ApiPropertyOptional({ default: 20, maximum: 100 }) limit = 20;
  @ApiPropertyOptional() search?: string;
  @ApiPropertyOptional() countryId?: string;
  @ApiPropertyOptional() disciplineId?: string;
  @ApiPropertyOptional({ enum: RecordStatus }) status?: RecordStatus;
  @ApiPropertyOptional({ enum: PublicationStatus }) publicationStatus?: PublicationStatus;
  @ApiPropertyOptional() dateFrom?: Date;
  @ApiPropertyOptional() dateTo?: Date;
  @ApiPropertyOptional() upcoming?: boolean;
  @ApiPropertyOptional() archived: 'true' | 'false' | 'all' = 'false';
  @ApiPropertyOptional() sortBy: 'startDate' | 'endDate' | 'title' | 'createdAt' = 'startDate';
  @ApiPropertyOptional() sortOrder: 'asc' | 'desc' = 'asc';
}

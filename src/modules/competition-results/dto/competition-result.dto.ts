import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PublicationStatus } from '@prisma/client';
import { z } from 'zod';

import {
  archivedSchema,
  boundedDecimalSchema,
  nonNegativeDecimalSchema,
  publicationStatusSchema,
  requiredString,
  sortOrderSchema,
  uuidSchema,
} from '../../../common/dto/schemas';
import { paginationSchema } from '../../../common/pagination/pagination.dto';

const metricBase = z
  .object({
    metricCode: requiredString(80),
    numericValue: boundedDecimalSchema.nullable().optional(),
    textValue: z.string().trim().max(500).nullable().optional(),
    unit: z.string().trim().max(80).nullable().optional(),
    sortOrder: z.coerce.number().int().min(0).max(100_000).optional(),
  })
  .strict();

const metricFields = metricBase.superRefine((value, context) => {
  const numeric = value.numericValue !== undefined && value.numericValue !== null;
  const text = value.textValue !== undefined && value.textValue !== null;
  if (numeric === text) {
    context.addIssue({
      code: 'custom',
      message: 'Exactly one of numericValue or textValue must be provided',
    });
  }
});

export class CreateResultMetricDto {
  static readonly schema = metricFields;
  @ApiProperty() metricCode!: string;
  @ApiPropertyOptional({ nullable: true }) numericValue?: number | null;
  @ApiPropertyOptional({ nullable: true }) textValue?: string | null;
  @ApiPropertyOptional({ nullable: true }) unit?: string | null;
  @ApiPropertyOptional({ minimum: 0 }) sortOrder?: number;
}

export class UpdateResultMetricDto {
  static readonly schema = metricBase
    .partial()
    .strict()
    .superRefine((value, context) => {
      if (
        value.numericValue !== undefined &&
        value.numericValue !== null &&
        value.textValue !== undefined &&
        value.textValue !== null
      ) {
        context.addIssue({
          code: 'custom',
          message: 'numericValue and textValue cannot both be provided',
        });
      }
    });
  @ApiPropertyOptional() metricCode?: string;
  @ApiPropertyOptional({ nullable: true }) numericValue?: number | null;
  @ApiPropertyOptional({ nullable: true }) textValue?: string | null;
  @ApiPropertyOptional({ nullable: true }) unit?: string | null;
  @ApiPropertyOptional({ minimum: 0 }) sortOrder?: number;
}

const resultFields = z
  .object({
    competitionClassId: uuidSchema,
    athleteId: uuidSchema,
    horseId: uuidSchema,
    rank: z.coerce.number().int().positive().nullable().optional(),
    statusId: uuidSchema.nullable().optional(),
    resultDisplay: z.string().trim().max(500).nullable().optional(),
    penalties: nonNegativeDecimalSchema.nullable().optional(),
    timeSeconds: nonNegativeDecimalSchema.nullable().optional(),
    points: boundedDecimalSchema.nullable().optional(),
    bonus: boundedDecimalSchema.nullable().optional(),
    sourceDocumentId: uuidSchema.nullable().optional(),
    sourceReference: z.string().trim().max(500).nullable().optional(),
    publicationStatus: publicationStatusSchema.optional(),
    metrics: z.array(metricFields).max(100).optional(),
  })
  .strict();

export class CreateCompetitionResultDto {
  static readonly schema = resultFields;
  @ApiProperty({ format: 'uuid' }) competitionClassId!: string;
  @ApiProperty({ format: 'uuid' }) athleteId!: string;
  @ApiProperty({ format: 'uuid' }) horseId!: string;
  @ApiPropertyOptional({ minimum: 1, nullable: true }) rank?: number | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) statusId?: string | null;
  @ApiPropertyOptional({ nullable: true }) resultDisplay?: string | null;
  @ApiPropertyOptional({ minimum: 0, nullable: true }) penalties?: number | null;
  @ApiPropertyOptional({ minimum: 0, nullable: true }) timeSeconds?: number | null;
  @ApiPropertyOptional({ nullable: true }) points?: number | null;
  @ApiPropertyOptional({ nullable: true }) bonus?: number | null;
  @ApiPropertyOptional({ nullable: true }) sourceDocumentId?: string | null;
  @ApiPropertyOptional({ nullable: true }) sourceReference?: string | null;
  @ApiPropertyOptional({ enum: PublicationStatus }) publicationStatus?: PublicationStatus;
  @ApiPropertyOptional({ type: [CreateResultMetricDto] }) metrics?: CreateResultMetricDto[];
}

export class UpdateCompetitionResultDto {
  static readonly schema = resultFields.omit({ metrics: true }).partial().strict();
  @ApiPropertyOptional() competitionClassId?: string;
  @ApiPropertyOptional() athleteId?: string;
  @ApiPropertyOptional() horseId?: string;
  @ApiPropertyOptional({ minimum: 1, nullable: true }) rank?: number | null;
  @ApiPropertyOptional({ nullable: true }) statusId?: string | null;
  @ApiPropertyOptional({ nullable: true }) resultDisplay?: string | null;
  @ApiPropertyOptional({ nullable: true }) penalties?: number | null;
  @ApiPropertyOptional({ nullable: true }) timeSeconds?: number | null;
  @ApiPropertyOptional({ nullable: true }) points?: number | null;
  @ApiPropertyOptional({ nullable: true }) bonus?: number | null;
  @ApiPropertyOptional({ nullable: true }) sourceDocumentId?: string | null;
  @ApiPropertyOptional({ nullable: true }) sourceReference?: string | null;
  @ApiPropertyOptional({ enum: PublicationStatus }) publicationStatus?: PublicationStatus;
}

export class CompetitionResultListQueryDto {
  static readonly schema = paginationSchema
    .extend({
      competitionEventId: uuidSchema.optional(),
      competitionClassId: uuidSchema.optional(),
      athleteId: uuidSchema.optional(),
      horseId: uuidSchema.optional(),
      disciplineId: uuidSchema.optional(),
      statusId: uuidSchema.optional(),
      statusCode: z.string().trim().max(80).optional(),
      publicationStatus: publicationStatusSchema.optional(),
      hasRank: z.coerce.boolean().optional(),
      archived: archivedSchema,
      sortBy: z.enum(['rank', 'points', 'timeSeconds', 'penalties', 'createdAt']).default('rank'),
      sortOrder: sortOrderSchema,
    })
    .strict();
  @ApiPropertyOptional({ default: 1 }) page = 1;
  @ApiPropertyOptional({ default: 20, maximum: 100 }) limit = 20;
  @ApiPropertyOptional() competitionEventId?: string;
  @ApiPropertyOptional() competitionClassId?: string;
  @ApiPropertyOptional() athleteId?: string;
  @ApiPropertyOptional() horseId?: string;
  @ApiPropertyOptional() disciplineId?: string;
  @ApiPropertyOptional() statusId?: string;
  @ApiPropertyOptional() statusCode?: string;
  @ApiPropertyOptional({ enum: PublicationStatus }) publicationStatus?: PublicationStatus;
  @ApiPropertyOptional() hasRank?: boolean;
  @ApiPropertyOptional() archived: 'true' | 'false' | 'all' = 'false';
  @ApiPropertyOptional() sortBy: 'rank' | 'points' | 'timeSeconds' | 'penalties' | 'createdAt' =
    'rank';
  @ApiPropertyOptional() sortOrder: 'asc' | 'desc' = 'asc';
}

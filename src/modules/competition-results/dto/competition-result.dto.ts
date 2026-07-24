import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PublicationStatus } from '@prisma/client';
import { z } from 'zod';

import {
  archivedSchema,
  boundedDecimalSchema,
  nonNegativeDecimalSchema,
  publicationStatusSchema,
  queryBooleanSchema,
  requiredString,
  requireAtLeastOneField,
  sortOrderSchema,
  uuidSchema,
} from '../../../common/dto/schemas';
import { paginationSchema } from '../../../common/pagination/pagination.dto';

const metricBase = z
  .object({
    metricCode: requiredString(80),
    numericValue: boundedDecimalSchema.nullable().optional(),
    textValue: z.string().trim().min(1).max(500).nullable().optional(),
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
  @ApiPropertyOptional({ type: Number, nullable: true }) numericValue?: number | null;
  @ApiPropertyOptional({ type: String, nullable: true }) textValue?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) unit?: string | null;
  @ApiPropertyOptional({ minimum: 0 }) sortOrder?: number;
}

export class UpdateResultMetricDto {
  static readonly schema = metricBase
    .partial()
    .strict()
    .superRefine((value, context) => {
      requireAtLeastOneField(value, context);
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
  @ApiPropertyOptional({ type: Number, nullable: true }) numericValue?: number | null;
  @ApiPropertyOptional({ type: String, nullable: true }) textValue?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) unit?: string | null;
  @ApiPropertyOptional({ minimum: 0 }) sortOrder?: number;
}

const resultFieldsBase = z
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
    metrics: z.array(metricFields).max(100).optional(),
  })
  .strict();

const resultFields = resultFieldsBase.superRefine((value, context) => {
  const hasDirectOutcome =
    value.rank != null ||
    value.statusId != null ||
    (typeof value.resultDisplay === 'string' && value.resultDisplay.length > 0) ||
    value.penalties != null ||
    value.timeSeconds != null ||
    value.points != null ||
    value.bonus != null;
  const hasMetricOutcome = (value.metrics?.length ?? 0) > 0;

  if (!hasDirectOutcome && !hasMetricOutcome) {
    context.addIssue({
      code: 'custom',
      message: 'At least one result outcome or metric must be provided',
    });
  }
});

export class CreateCompetitionResultDto {
  static readonly schema = resultFields;
  @ApiProperty({ format: 'uuid' }) competitionClassId!: string;
  @ApiProperty({ format: 'uuid' }) athleteId!: string;
  @ApiProperty({ format: 'uuid' }) horseId!: string;
  @ApiPropertyOptional({ type: 'integer', minimum: 1, nullable: true }) rank?: number | null;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true }) statusId?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) resultDisplay?: string | null;
  @ApiPropertyOptional({ type: Number, minimum: 0, nullable: true }) penalties?: number | null;
  @ApiPropertyOptional({ type: Number, minimum: 0, nullable: true }) timeSeconds?: number | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) points?: number | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) bonus?: number | null;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  sourceDocumentId?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) sourceReference?: string | null;
  @ApiPropertyOptional({ type: [CreateResultMetricDto] }) metrics?: CreateResultMetricDto[];
}

export class UpdateCompetitionResultDto {
  static readonly schema = resultFieldsBase
    .omit({ metrics: true })
    .partial()
    .strict()
    .superRefine(requireAtLeastOneField);
  @ApiPropertyOptional({ type: String, format: 'uuid' }) competitionClassId?: string;
  @ApiPropertyOptional({ type: String, format: 'uuid' }) athleteId?: string;
  @ApiPropertyOptional({ type: String, format: 'uuid' }) horseId?: string;
  @ApiPropertyOptional({ type: 'integer', minimum: 1, nullable: true }) rank?: number | null;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true }) statusId?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) resultDisplay?: string | null;
  @ApiPropertyOptional({ type: Number, minimum: 0, nullable: true }) penalties?: number | null;
  @ApiPropertyOptional({ type: Number, minimum: 0, nullable: true }) timeSeconds?: number | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) points?: number | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) bonus?: number | null;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  sourceDocumentId?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) sourceReference?: string | null;
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
      hasRank: queryBooleanSchema.optional(),
      archived: archivedSchema,
      sortBy: z.enum(['rank', 'points', 'timeSeconds', 'penalties', 'createdAt']).default('rank'),
      sortOrder: sortOrderSchema,
    })
    .strict();
  @ApiPropertyOptional({ type: 'integer', default: 1, minimum: 1 }) page = 1;
  @ApiPropertyOptional({ type: 'integer', default: 20, minimum: 1, maximum: 100 })
  limit = 20;
  @ApiPropertyOptional({ type: String, format: 'uuid' }) competitionEventId?: string;
  @ApiPropertyOptional({ type: String, format: 'uuid' }) competitionClassId?: string;
  @ApiPropertyOptional({ type: String, format: 'uuid' }) athleteId?: string;
  @ApiPropertyOptional({ type: String, format: 'uuid' }) horseId?: string;
  @ApiPropertyOptional({ type: String, format: 'uuid' }) disciplineId?: string;
  @ApiPropertyOptional({ type: String, format: 'uuid' }) statusId?: string;
  @ApiPropertyOptional() statusCode?: string;
  @ApiPropertyOptional({ enum: PublicationStatus }) publicationStatus?: PublicationStatus;
  @ApiPropertyOptional({ type: Boolean }) hasRank?: boolean;
  @ApiPropertyOptional({ type: String, enum: ['true', 'false', 'all'], default: 'false' })
  archived: 'true' | 'false' | 'all' = 'false';
  @ApiPropertyOptional({
    type: String,
    enum: ['rank', 'points', 'timeSeconds', 'penalties', 'createdAt'],
    default: 'rank',
  })
  sortBy: 'rank' | 'points' | 'timeSeconds' | 'penalties' | 'createdAt' = 'rank';
  @ApiPropertyOptional({ type: String, enum: ['asc', 'desc'], default: 'asc' })
  sortOrder: 'asc' | 'desc' = 'asc';
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

import {
  dateStringSchema,
  ensureDateOrder,
  queryBooleanSchema,
  sortOrderSchema,
  uuidSchema,
} from '../../../common/dto/schemas';
import { paginationSchema } from '../../../common/pagination/pagination.dto';

export enum PublicLocale {
  RO = 'ro',
  RU = 'ru',
}

const searchSchema = z.string().trim().min(2).max(200).optional();
const publicListSchema = paginationSchema.extend({
  search: searchSchema,
  sortOrder: sortOrderSchema,
});

abstract class PublicPaginatedQueryDto {
  @ApiPropertyOptional({ type: 'integer', default: 1, minimum: 1 })
  page = 1;

  @ApiPropertyOptional({ type: 'integer', default: 20, minimum: 1, maximum: 100 })
  limit = 20;

  @ApiPropertyOptional({ minLength: 2, maxLength: 200 })
  search?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
  sortOrder: 'asc' | 'desc' = 'asc';
}

export class PublicCountryListQueryDto extends PublicPaginatedQueryDto {
  static readonly schema = publicListSchema
    .extend({
      sortBy: z.enum(['name', 'isoAlpha2', 'isoAlpha3']).default('name'),
    })
    .strict();

  @ApiPropertyOptional({ enum: ['name', 'isoAlpha2', 'isoAlpha3'], default: 'name' })
  sortBy: 'name' | 'isoAlpha2' | 'isoAlpha3' = 'name';
}

export class PublicDisciplineListQueryDto extends PublicPaginatedQueryDto {
  static readonly schema = publicListSchema
    .extend({
      sortBy: z.enum(['name', 'code']).default('name'),
    })
    .strict();

  @ApiPropertyOptional({ enum: ['name', 'code'], default: 'name' })
  sortBy: 'name' | 'code' = 'name';
}

export class PublicClubListQueryDto extends PublicPaginatedQueryDto {
  static readonly schema = publicListSchema
    .extend({
      countryId: uuidSchema.optional(),
      federationId: uuidSchema.optional(),
      sortBy: z.enum(['name']).default('name'),
    })
    .strict();

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  countryId?: string;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  federationId?: string;

  @ApiPropertyOptional({ enum: ['name'], default: 'name' })
  sortBy = 'name' as const;
}

export class PublicAthleteListQueryDto extends PublicPaginatedQueryDto {
  static readonly schema = publicListSchema
    .extend({
      countryId: uuidSchema.optional(),
      federationId: uuidSchema.optional(),
      clubId: uuidSchema.optional(),
      sortBy: z.enum(['displayName', 'lastName']).default('displayName'),
    })
    .strict();

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  countryId?: string;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  federationId?: string;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  clubId?: string;

  @ApiPropertyOptional({ enum: ['displayName', 'lastName'], default: 'displayName' })
  sortBy: 'displayName' | 'lastName' = 'displayName';
}

export class PublicHorseListQueryDto extends PublicPaginatedQueryDto {
  static readonly schema = publicListSchema
    .extend({
      birthYear: z.coerce.number().int().min(1000).max(3000).optional(),
      sex: z.string().trim().min(1).max(80).optional(),
      breed: z.string().trim().min(1).max(240).optional(),
      color: z.string().trim().min(1).max(120).optional(),
      countryOfBirthId: uuidSchema.optional(),
      athleteId: uuidSchema.optional(),
      sortBy: z.enum(['displayName', 'passportName', 'birthYear']).default('displayName'),
    })
    .strict();

  @ApiPropertyOptional({ type: 'integer', minimum: 1000, maximum: 3000 })
  birthYear?: number;

  @ApiPropertyOptional({ maxLength: 80 })
  sex?: string;

  @ApiPropertyOptional({ maxLength: 240 })
  breed?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  color?: string;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  countryOfBirthId?: string;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  athleteId?: string;

  @ApiPropertyOptional({
    enum: ['displayName', 'passportName', 'birthYear'],
    default: 'displayName',
  })
  sortBy: 'displayName' | 'passportName' | 'birthYear' = 'displayName';
}

export class PublicCompetitionListQueryDto extends PublicPaginatedQueryDto {
  static readonly schema = publicListSchema
    .extend({
      countryId: uuidSchema.optional(),
      disciplineId: uuidSchema.optional(),
      dateFrom: dateStringSchema.optional(),
      dateTo: dateStringSchema.optional(),
      upcoming: queryBooleanSchema.optional(),
      sortBy: z.enum(['startDate', 'endDate', 'title']).default('startDate'),
    })
    .strict()
    .superRefine((value, context) => {
      ensureDateOrder({ startDate: value.dateFrom, endDate: value.dateTo }, context);
    });

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  countryId?: string;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  disciplineId?: string;

  @ApiPropertyOptional({ type: String, format: 'date' })
  dateFrom?: Date;

  @ApiPropertyOptional({ type: String, format: 'date' })
  dateTo?: Date;

  @ApiPropertyOptional({ type: Boolean })
  upcoming?: boolean;

  @ApiPropertyOptional({ enum: ['startDate', 'endDate', 'title'], default: 'startDate' })
  sortBy: 'startDate' | 'endDate' | 'title' = 'startDate';
}

export class PublicCompetitionClassListQueryDto extends PublicPaginatedQueryDto {
  static readonly schema = publicListSchema
    .extend({
      competitionSlug: z.string().trim().min(1).max(240).optional(),
      disciplineId: uuidSchema.optional(),
      category: z.string().trim().min(1).max(120).optional(),
      level: z.string().trim().min(1).max(120).optional(),
      dateFrom: dateStringSchema.optional(),
      dateTo: dateStringSchema.optional(),
      sortBy: z.enum(['competitionDate', 'sortOrder', 'title']).default('competitionDate'),
    })
    .strict()
    .superRefine((value, context) => {
      ensureDateOrder({ startDate: value.dateFrom, endDate: value.dateTo }, context);
    });

  @ApiPropertyOptional({ maxLength: 240 })
  competitionSlug?: string;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  disciplineId?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  category?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  level?: string;

  @ApiPropertyOptional({ type: String, format: 'date' })
  dateFrom?: Date;

  @ApiPropertyOptional({ type: String, format: 'date' })
  dateTo?: Date;

  @ApiPropertyOptional({
    enum: ['competitionDate', 'sortOrder', 'title'],
    default: 'competitionDate',
  })
  sortBy: 'competitionDate' | 'sortOrder' | 'title' = 'competitionDate';
}

export class PublicResultListQueryDto {
  static readonly schema = paginationSchema
    .extend({
      competitionSlug: z.string().trim().min(1).max(240).optional(),
      competitionClassId: uuidSchema.optional(),
      athleteId: uuidSchema.optional(),
      horseId: uuidSchema.optional(),
      disciplineId: uuidSchema.optional(),
      statusCode: z.string().trim().min(1).max(80).optional(),
      hasRank: queryBooleanSchema.optional(),
      sortBy: z.enum(['rank', 'points', 'timeSeconds', 'penalties']).default('rank'),
      sortOrder: sortOrderSchema,
    })
    .strict();

  @ApiPropertyOptional({ type: 'integer', default: 1, minimum: 1 })
  page = 1;

  @ApiPropertyOptional({ type: 'integer', default: 20, minimum: 1, maximum: 100 })
  limit = 20;

  @ApiPropertyOptional({ maxLength: 240 })
  competitionSlug?: string;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  competitionClassId?: string;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  athleteId?: string;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  horseId?: string;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  disciplineId?: string;

  @ApiPropertyOptional({ maxLength: 80 })
  statusCode?: string;

  @ApiPropertyOptional({ type: Boolean })
  hasRank?: boolean;

  @ApiPropertyOptional({
    enum: ['rank', 'points', 'timeSeconds', 'penalties'],
    default: 'rank',
  })
  sortBy: 'rank' | 'points' | 'timeSeconds' | 'penalties' = 'rank';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
  sortOrder: 'asc' | 'desc' = 'asc';
}

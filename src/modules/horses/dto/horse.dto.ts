import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RecordStatus } from '@prisma/client';
import { z } from 'zod';

import {
  archivedSchema,
  dateStringSchema,
  ensureDateOrder,
  nullableDateStringSchema,
  nonNegativeDecimalSchema,
  recordStatusSchema,
  requiredString,
  sortOrderSchema,
  uuidSchema,
} from '../../../common/dto/schemas';
import { paginationSchema } from '../../../common/pagination/pagination.dto';

const horseFields = z
  .object({
    passportName: z.string().trim().max(240).nullable().optional(),
    displayName: requiredString(240),
    dateOfBirth: nullableDateStringSchema.optional(),
    birthYear: z.coerce.number().int().min(1000).max(2100).nullable().optional(),
    sex: z.string().trim().max(80).nullable().optional(),
    breed: z.string().trim().max(160).nullable().optional(),
    color: z.string().trim().max(120).nullable().optional(),
    countryOfBirthId: uuidSchema.nullable().optional(),
    studbook: z.string().trim().max(160).nullable().optional(),
    imageId: uuidSchema.nullable().optional(),
    status: recordStatusSchema.optional(),
  })
  .strict();

export class CreateHorseDto {
  static readonly schema = horseFields;
  @ApiProperty({ example: 'Demo Aurora' }) displayName!: string;
  @ApiPropertyOptional({ nullable: true }) passportName?: string | null;
  @ApiPropertyOptional({ format: 'date', nullable: true }) dateOfBirth?: Date | null;
  @ApiPropertyOptional({ nullable: true }) birthYear?: number | null;
  @ApiPropertyOptional({ nullable: true }) sex?: string | null;
  @ApiPropertyOptional({ nullable: true }) breed?: string | null;
  @ApiPropertyOptional({ nullable: true }) color?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) countryOfBirthId?: string | null;
  @ApiPropertyOptional({ nullable: true }) studbook?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) imageId?: string | null;
  @ApiPropertyOptional({ enum: RecordStatus }) status?: RecordStatus;
}

export class UpdateHorseDto {
  static readonly schema = horseFields.partial().strict();
  @ApiPropertyOptional() displayName?: string;
  @ApiPropertyOptional({ nullable: true }) passportName?: string | null;
  @ApiPropertyOptional({ nullable: true }) dateOfBirth?: Date | null;
  @ApiPropertyOptional({ nullable: true }) birthYear?: number | null;
  @ApiPropertyOptional({ nullable: true }) sex?: string | null;
  @ApiPropertyOptional({ nullable: true }) breed?: string | null;
  @ApiPropertyOptional({ nullable: true }) color?: string | null;
  @ApiPropertyOptional({ nullable: true }) countryOfBirthId?: string | null;
  @ApiPropertyOptional({ nullable: true }) studbook?: string | null;
  @ApiPropertyOptional({ nullable: true }) imageId?: string | null;
  @ApiPropertyOptional({ enum: RecordStatus }) status?: RecordStatus;
}

export class HorseListQueryDto {
  static readonly schema = paginationSchema
    .extend({
      search: z.string().trim().max(200).optional(),
      sex: z.string().trim().max(80).optional(),
      breed: z.string().trim().max(160).optional(),
      color: z.string().trim().max(120).optional(),
      birthYear: z.coerce.number().int().min(1000).max(2100).optional(),
      countryOfBirthId: uuidSchema.optional(),
      status: recordStatusSchema.optional(),
      archived: archivedSchema,
      sortBy: z
        .enum(['displayName', 'passportName', 'birthYear', 'createdAt'])
        .default('displayName'),
      sortOrder: sortOrderSchema,
    })
    .strict();
  @ApiPropertyOptional({ default: 1 }) page = 1;
  @ApiPropertyOptional({ default: 20, maximum: 100 }) limit = 20;
  @ApiPropertyOptional() search?: string;
  @ApiPropertyOptional() sex?: string;
  @ApiPropertyOptional() breed?: string;
  @ApiPropertyOptional() color?: string;
  @ApiPropertyOptional() birthYear?: number;
  @ApiPropertyOptional({ format: 'uuid' }) countryOfBirthId?: string;
  @ApiPropertyOptional({ enum: RecordStatus }) status?: RecordStatus;
  @ApiPropertyOptional({ enum: ['true', 'false', 'all'] }) archived: 'true' | 'false' | 'all' =
    'false';
  @ApiPropertyOptional() sortBy: 'displayName' | 'passportName' | 'birthYear' | 'createdAt' =
    'displayName';
  @ApiPropertyOptional({ enum: ['asc', 'desc'] }) sortOrder: 'asc' | 'desc' = 'asc';
}

const ownershipFields = z
  .object({
    ownerId: uuidSchema,
    startDate: dateStringSchema,
    endDate: nullableDateStringSchema.optional(),
    ownershipShare: nonNegativeDecimalSchema.max(100).nullable().optional(),
    sourceDocumentId: uuidSchema.nullable().optional(),
  })
  .strict();

export class CreateHorseOwnershipDto {
  static readonly schema = ownershipFields.superRefine(ensureDateOrder);
  @ApiProperty({ format: 'uuid' }) ownerId!: string;
  @ApiProperty({ format: 'date' }) startDate!: Date;
  @ApiPropertyOptional({ nullable: true }) endDate?: Date | null;
  @ApiPropertyOptional({ minimum: 0, maximum: 100, nullable: true }) ownershipShare?: number | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) sourceDocumentId?: string | null;
}

export class UpdateHorseOwnershipDto {
  static readonly schema = ownershipFields.partial().strict().superRefine(ensureDateOrder);
  @ApiPropertyOptional({ format: 'uuid' }) ownerId?: string;
  @ApiPropertyOptional() startDate?: Date;
  @ApiPropertyOptional({ nullable: true }) endDate?: Date | null;
  @ApiPropertyOptional({ minimum: 0, maximum: 100, nullable: true }) ownershipShare?: number | null;
  @ApiPropertyOptional({ nullable: true }) sourceDocumentId?: string | null;
}

const athleteRelationFields = z
  .object({
    athleteId: uuidSchema,
    relationType: z.string().trim().max(80).nullable().optional(),
    disciplineId: uuidSchema.nullable().optional(),
    startDate: dateStringSchema,
    endDate: nullableDateStringSchema.optional(),
    sourceDocumentId: uuidSchema.nullable().optional(),
  })
  .strict();

export class CreateHorseAthleteRelationDto {
  static readonly schema = athleteRelationFields.superRefine(ensureDateOrder);
  @ApiProperty({ format: 'uuid' }) athleteId!: string;
  @ApiPropertyOptional({ nullable: true }) relationType?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) disciplineId?: string | null;
  @ApiProperty({ format: 'date' }) startDate!: Date;
  @ApiPropertyOptional({ nullable: true }) endDate?: Date | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) sourceDocumentId?: string | null;
}

export class UpdateHorseAthleteRelationDto {
  static readonly schema = athleteRelationFields.partial().strict().superRefine(ensureDateOrder);
  @ApiPropertyOptional({ format: 'uuid' }) athleteId?: string;
  @ApiPropertyOptional({ nullable: true }) relationType?: string | null;
  @ApiPropertyOptional({ nullable: true }) disciplineId?: string | null;
  @ApiPropertyOptional() startDate?: Date;
  @ApiPropertyOptional({ nullable: true }) endDate?: Date | null;
  @ApiPropertyOptional({ nullable: true }) sourceDocumentId?: string | null;
}

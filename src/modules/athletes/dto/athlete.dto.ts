import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RecordStatus } from '@prisma/client';
import { z } from 'zod';
import {
  archivedSchema,
  dateStringSchema,
  ensureDateOrder,
  nullableDateStringSchema,
  recordStatusSchema,
  requiredString,
  sortOrderSchema,
  uuidSchema,
} from '../../../common/dto/schemas';
import { paginationSchema } from '../../../common/pagination/pagination.dto';
const athleteFields = z
  .object({
    firstName: requiredString(120),
    lastName: requiredString(120),
    displayName: requiredString(240),
    dateOfBirth: nullableDateStringSchema.optional(),
    gender: z.string().trim().max(80).nullable().optional(),
    countryId: uuidSchema.nullable().optional(),
    nationalFederationId: uuidSchema.nullable().optional(),
    photoId: uuidSchema.nullable().optional(),
    status: recordStatusSchema.optional(),
  })
  .strict();
export class CreateAthleteDto {
  static readonly schema = athleteFields;
  @ApiProperty({ example: 'Ana' }) firstName!: string;
  @ApiProperty({ example: 'Fictiva' }) lastName!: string;
  @ApiProperty({ example: 'Ana Fictiva' }) displayName!: string;
  @ApiPropertyOptional({ format: 'date', nullable: true }) dateOfBirth?: Date | null;
  @ApiPropertyOptional({ nullable: true }) gender?: string | null;
  @ApiPropertyOptional({ nullable: true, format: 'uuid' }) countryId?: string | null;
  @ApiPropertyOptional({ nullable: true, format: 'uuid' }) nationalFederationId?: string | null;
  @ApiPropertyOptional({ nullable: true, format: 'uuid' }) photoId?: string | null;
  @ApiPropertyOptional({ enum: RecordStatus }) status?: RecordStatus;
}
export class UpdateAthleteDto {
  static readonly schema = athleteFields.partial().strict();
  @ApiPropertyOptional() firstName?: string;
  @ApiPropertyOptional() lastName?: string;
  @ApiPropertyOptional() displayName?: string;
  @ApiPropertyOptional({ nullable: true }) dateOfBirth?: Date | null;
  @ApiPropertyOptional({ nullable: true }) gender?: string | null;
  @ApiPropertyOptional({ nullable: true }) countryId?: string | null;
  @ApiPropertyOptional({ nullable: true }) nationalFederationId?: string | null;
  @ApiPropertyOptional({ nullable: true }) photoId?: string | null;
  @ApiPropertyOptional({ enum: RecordStatus }) status?: RecordStatus;
}
export class AthleteListQueryDto {
  static readonly schema = paginationSchema
    .extend({
      search: z.string().trim().max(200).optional(),
      countryId: uuidSchema.optional(),
      federationId: uuidSchema.optional(),
      clubId: uuidSchema.optional(),
      status: recordStatusSchema.optional(),
      archived: archivedSchema,
      sortBy: z.enum(['lastName', 'displayName', 'createdAt', 'updatedAt']).default('lastName'),
      sortOrder: sortOrderSchema,
    })
    .strict();
  @ApiPropertyOptional({ default: 1 }) page = 1;
  @ApiPropertyOptional({ default: 20, maximum: 100 }) limit = 20;
  @ApiPropertyOptional() search?: string;
  @ApiPropertyOptional() countryId?: string;
  @ApiPropertyOptional() federationId?: string;
  @ApiPropertyOptional() clubId?: string;
  @ApiPropertyOptional({ enum: RecordStatus }) status?: RecordStatus;
  @ApiPropertyOptional({ enum: ['true', 'false', 'all'], default: 'false' }) archived:
    'true' | 'false' | 'all' = 'false';
  @ApiPropertyOptional({ enum: ['lastName', 'displayName', 'createdAt', 'updatedAt'] }) sortBy:
    'lastName' | 'displayName' | 'createdAt' | 'updatedAt' = 'lastName';
  @ApiPropertyOptional({ enum: ['asc', 'desc'] }) sortOrder: 'asc' | 'desc' = 'asc';
}
const membershipFields = z
  .object({
    clubId: uuidSchema,
    membershipType: z.string().trim().max(80).nullable().optional(),
    startDate: dateStringSchema,
    endDate: nullableDateStringSchema.optional(),
    sourceDocumentId: uuidSchema.nullable().optional(),
  })
  .strict();
export class CreateAthleteClubMembershipDto {
  static readonly schema = membershipFields.superRefine(ensureDateOrder);
  @ApiProperty({ format: 'uuid' }) clubId!: string;
  @ApiPropertyOptional({ nullable: true }) membershipType?: string | null;
  @ApiProperty({ format: 'date' }) startDate!: Date;
  @ApiPropertyOptional({ format: 'date', nullable: true }) endDate?: Date | null;
  @ApiPropertyOptional({ nullable: true }) sourceDocumentId?: string | null;
}
export class UpdateAthleteClubMembershipDto {
  static readonly schema = membershipFields.partial().strict().superRefine(ensureDateOrder);
  @ApiPropertyOptional() clubId?: string;
  @ApiPropertyOptional({ nullable: true }) membershipType?: string | null;
  @ApiPropertyOptional() startDate?: Date;
  @ApiPropertyOptional({ nullable: true }) endDate?: Date | null;
  @ApiPropertyOptional({ nullable: true }) sourceDocumentId?: string | null;
}
const horseRelationFields = z
  .object({
    horseId: uuidSchema,
    relationType: z.string().trim().max(80).nullable().optional(),
    disciplineId: uuidSchema.nullable().optional(),
    startDate: dateStringSchema,
    endDate: nullableDateStringSchema.optional(),
    sourceDocumentId: uuidSchema.nullable().optional(),
  })
  .strict();
export class CreateAthleteHorseRelationDto {
  static readonly schema = horseRelationFields.superRefine(ensureDateOrder);
  @ApiProperty({ format: 'uuid' }) horseId!: string;
  @ApiPropertyOptional({ nullable: true }) relationType?: string | null;
  @ApiPropertyOptional({ nullable: true }) disciplineId?: string | null;
  @ApiProperty() startDate!: Date;
  @ApiPropertyOptional({ nullable: true }) endDate?: Date | null;
  @ApiPropertyOptional({ nullable: true }) sourceDocumentId?: string | null;
}
export class UpdateAthleteHorseRelationDto {
  static readonly schema = horseRelationFields.partial().strict().superRefine(ensureDateOrder);
  @ApiPropertyOptional() horseId?: string;
  @ApiPropertyOptional({ nullable: true }) relationType?: string | null;
  @ApiPropertyOptional({ nullable: true }) disciplineId?: string | null;
  @ApiPropertyOptional() startDate?: Date;
  @ApiPropertyOptional({ nullable: true }) endDate?: Date | null;
  @ApiPropertyOptional({ nullable: true }) sourceDocumentId?: string | null;
}

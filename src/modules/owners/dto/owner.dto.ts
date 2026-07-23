import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RecordStatus } from '@prisma/client';
import { z } from 'zod';
import {
  archivedSchema,
  recordStatusSchema,
  requiredString,
  sortOrderSchema,
  uuidSchema,
} from '../../../common/dto/schemas';
import { paginationSchema } from '../../../common/pagination/pagination.dto';
export class CreateOwnerDto {
  static readonly schema = z
    .object({
      displayName: requiredString(200),
      ownerType: z.string().trim().max(80).nullable().optional(),
      countryId: uuidSchema.nullable().optional(),
      status: recordStatusSchema.optional(),
    })
    .strict();
  @ApiProperty({ example: 'Fictional Owner 1' }) displayName!: string;
  @ApiPropertyOptional({ nullable: true }) ownerType?: string | null;
  @ApiPropertyOptional({ nullable: true, format: 'uuid' }) countryId?: string | null;
  @ApiPropertyOptional({ enum: RecordStatus }) status?: RecordStatus;
}
export class UpdateOwnerDto {
  static readonly schema = CreateOwnerDto.schema.partial().strict();
  @ApiPropertyOptional() displayName?: string;
  @ApiPropertyOptional({ nullable: true }) ownerType?: string | null;
  @ApiPropertyOptional({ nullable: true }) countryId?: string | null;
  @ApiPropertyOptional({ enum: RecordStatus }) status?: RecordStatus;
}
export class OwnerListQueryDto {
  static readonly schema = paginationSchema
    .extend({
      search: z.string().trim().max(200).optional(),
      countryId: uuidSchema.optional(),
      status: recordStatusSchema.optional(),
      archived: archivedSchema,
      sortBy: z.enum(['displayName', 'createdAt']).default('displayName'),
      sortOrder: sortOrderSchema,
    })
    .strict();
  @ApiPropertyOptional({ default: 1 }) page = 1;
  @ApiPropertyOptional({ default: 20, maximum: 100 }) limit = 20;
  @ApiPropertyOptional() search?: string;
  @ApiPropertyOptional() countryId?: string;
  @ApiPropertyOptional({ enum: RecordStatus }) status?: RecordStatus;
  @ApiPropertyOptional({ enum: ['true', 'false', 'all'], default: 'false' }) archived:
    'true' | 'false' | 'all' = 'false';
  @ApiPropertyOptional({ enum: ['displayName', 'createdAt'] }) sortBy: 'displayName' | 'createdAt' =
    'displayName';
  @ApiPropertyOptional({ enum: ['asc', 'desc'] }) sortOrder: 'asc' | 'desc' = 'asc';
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

import { archivedSchema, requiredString, sortOrderSchema } from '../../../common/dto/schemas';
import { paginationSchema } from '../../../common/pagination/pagination.dto';

export class CreateCountryDto {
  static readonly schema = z
    .object({
      isoAlpha2: z.string().trim().regex(/^[A-Z]{2}$/),
      isoAlpha3: z.string().trim().regex(/^[A-Z]{3}$/),
      name: requiredString(120),
    })
    .strict();

  @ApiProperty({ example: 'MD', minLength: 2, maxLength: 2 })
  isoAlpha2!: string;

  @ApiProperty({ example: 'MDA', minLength: 3, maxLength: 3 })
  isoAlpha3!: string;

  @ApiProperty({ example: 'Moldova', maxLength: 120 })
  name!: string;
}

export class UpdateCountryDto {
  static readonly schema = CreateCountryDto.schema.partial().strict();

  @ApiPropertyOptional({ example: 'MD' })
  isoAlpha2?: string;

  @ApiPropertyOptional({ example: 'MDA' })
  isoAlpha3?: string;

  @ApiPropertyOptional({ example: 'Moldova' })
  name?: string;
}

export class CountryListQueryDto {
  static readonly schema = paginationSchema
    .extend({
      search: z.string().trim().max(200).optional(),
      archived: archivedSchema,
      sortBy: z.enum(['name', 'isoAlpha2', 'isoAlpha3', 'createdAt']).default('name'),
      sortOrder: sortOrderSchema,
    })
    .strict();

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  page = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  limit = 20;

  @ApiPropertyOptional({ maxLength: 200 })
  search?: string;

  @ApiPropertyOptional({ enum: ['true', 'false', 'all'], default: 'false' })
  archived: 'true' | 'false' | 'all' = 'false';

  @ApiPropertyOptional({ enum: ['name', 'isoAlpha2', 'isoAlpha3', 'createdAt'], default: 'name' })
  sortBy: 'name' | 'isoAlpha2' | 'isoAlpha3' | 'createdAt' = 'name';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
  sortOrder: 'asc' | 'desc' = 'asc';
}

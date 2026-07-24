import { ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

import { archivedSchema, sortOrderSchema } from '../dto/schemas';

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const listQueryBaseSchema = paginationSchema.extend({
  search: z.string().trim().max(200).optional(),
  archived: archivedSchema,
  sortOrder: sortOrderSchema,
});

export class PaginationQueryDto {
  static readonly schema = paginationSchema.strict();

  @ApiPropertyOptional({ type: 'integer', default: 1, minimum: 1 })
  page = 1;

  @ApiPropertyOptional({ type: 'integer', default: 20, minimum: 1, maximum: 100 })
  limit = 20;
}

export interface PaginationQuery {
  page: number;
  limit: number;
}

export type ArchivedFilter = 'true' | 'false' | 'all';

export function paginationArgs(query: PaginationQuery): { skip: number; take: number } {
  return { skip: (query.page - 1) * query.limit, take: query.limit };
}

export function archivedAtFilter(value: ArchivedFilter): undefined | null | { not: null } {
  if (value === 'all') return undefined;
  return value === 'true' ? { not: null } : null;
}

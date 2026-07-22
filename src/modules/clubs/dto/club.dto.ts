import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RecordStatus } from '@prisma/client';
import { z } from 'zod';
import { archivedSchema, recordStatusSchema, requiredString, sortOrderSchema, uuidSchema } from '../../../common/dto/schemas';
import { paginationSchema } from '../../../common/pagination/pagination.dto';

export class CreateClubDto {
  static readonly schema=z.object({name:requiredString(200),legalName:z.string().trim().max(300).nullable().optional(),countryId:uuidSchema.nullable().optional(),nationalFederationId:uuidSchema.nullable().optional(),status:recordStatusSchema.optional()}).strict();
  @ApiProperty({example:'Demo Equestrian Club'}) name!:string;
  @ApiPropertyOptional({nullable:true}) legalName?:string|null;
  @ApiPropertyOptional({format:'uuid',nullable:true}) countryId?:string|null;
  @ApiPropertyOptional({format:'uuid',nullable:true}) nationalFederationId?:string|null;
  @ApiPropertyOptional({enum:RecordStatus}) status?:RecordStatus;
}
export class UpdateClubDto { static readonly schema=CreateClubDto.schema.partial().strict(); @ApiPropertyOptional() name?:string; @ApiPropertyOptional({nullable:true}) legalName?:string|null; @ApiPropertyOptional({nullable:true}) countryId?:string|null; @ApiPropertyOptional({nullable:true}) nationalFederationId?:string|null; @ApiPropertyOptional({enum:RecordStatus}) status?:RecordStatus; }
export class ClubListQueryDto {
  static readonly schema=paginationSchema.extend({search:z.string().trim().max(200).optional(),countryId:uuidSchema.optional(),federationId:uuidSchema.optional(),status:recordStatusSchema.optional(),archived:archivedSchema,sortBy:z.enum(['name','createdAt','updatedAt']).default('name'),sortOrder:sortOrderSchema}).strict();
  @ApiPropertyOptional({default:1}) page=1; @ApiPropertyOptional({default:20,maximum:100}) limit=20;
  @ApiPropertyOptional() search?:string; @ApiPropertyOptional({format:'uuid'}) countryId?:string; @ApiPropertyOptional({format:'uuid'}) federationId?:string; @ApiPropertyOptional({enum:RecordStatus}) status?:RecordStatus;
  @ApiPropertyOptional({enum:['true','false','all'],default:'false'}) archived:'true'|'false'|'all'='false'; @ApiPropertyOptional({enum:['name','createdAt','updatedAt'],default:'name'}) sortBy:'name'|'createdAt'|'updatedAt'='name'; @ApiPropertyOptional({enum:['asc','desc'],default:'asc'}) sortOrder:'asc'|'desc'='asc';
}

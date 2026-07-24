import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';
import {
  dateStringSchema,
  requiredString,
  requireAtLeastOneField,
} from '../../../common/dto/schemas';

const externalIdentifierFields = z
  .object({
    identifierType: requiredString(80),
    namespace: requiredString(120),
    value: requiredString(240),
    validFrom: dateStringSchema.nullable().optional(),
    validTo: dateStringSchema.nullable().optional(),
    sourceDocumentId: z.uuid().nullable().optional(),
    sourceReference: z.string().trim().max(500).nullable().optional(),
  })
  .strict();

const validateDates = (
  value: {
    validFrom?: Date | null | undefined;
    validTo?: Date | null | undefined;
  },
  ctx: z.RefinementCtx,
): void => {
  if (value.validFrom && value.validTo && value.validTo < value.validFrom) {
    ctx.addIssue({
      code: 'custom',
      path: ['validTo'],
      message: 'validTo must not be earlier than validFrom',
    });
  }
};

export class CreateExternalIdentifierDto {
  static readonly schema = externalIdentifierFields.superRefine(validateDates);
  @ApiProperty({ example: 'FEI_ID' }) identifierType!: string;
  @ApiProperty({ example: 'FEI' }) namespace!: string;
  @ApiProperty({ example: '12345678' }) value!: string;
  @ApiPropertyOptional({ type: String, nullable: true, format: 'date' })
  validFrom?: Date | null;
  @ApiPropertyOptional({ type: String, nullable: true, format: 'date' }) validTo?: Date | null;
  @ApiPropertyOptional({ type: String, nullable: true, format: 'uuid' })
  sourceDocumentId?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) sourceReference?: string | null;
}

export class UpdateExternalIdentifierDto {
  static readonly schema = externalIdentifierFields
    .pick({
      value: true,
      validFrom: true,
      validTo: true,
      sourceDocumentId: true,
      sourceReference: true,
    })
    .partial()
    .strict()
    .superRefine((value, context) => {
      requireAtLeastOneField(value, context);
      validateDates(value, context);
    });
  @ApiPropertyOptional() value?: string;
  @ApiPropertyOptional({ type: String, format: 'date', nullable: true })
  validFrom?: Date | null;
  @ApiPropertyOptional({ type: String, format: 'date', nullable: true }) validTo?: Date | null;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  sourceDocumentId?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) sourceReference?: string | null;
}

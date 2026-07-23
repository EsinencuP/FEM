import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VerificationStatus } from '@prisma/client';
import { z } from 'zod';
import {
  dateStringSchema,
  requiredString,
  verificationStatusSchema,
} from '../../../common/dto/schemas';

const externalIdentifierFields = z
  .object({
    identifierType: requiredString(80),
    namespace: requiredString(120),
    value: requiredString(240),
    normalizationVersion: requiredString(40).default('nfkc-trim-v1'),
    verificationStatus: verificationStatusSchema.default(VerificationStatus.UNVERIFIED),
    isPrimary: z.boolean().default(false),
    validFrom: dateStringSchema.nullable().optional(),
    validTo: dateStringSchema.nullable().optional(),
    sourceDocumentId: z.uuid().nullable().optional(),
    sourceReference: z.string().trim().max(500).nullable().optional(),
    verifiedAt: z.coerce.date().nullable().optional(),
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
  @ApiPropertyOptional({ default: 'nfkc-trim-v1' }) normalizationVersion = 'nfkc-trim-v1';
  @ApiPropertyOptional({ enum: VerificationStatus, default: VerificationStatus.UNVERIFIED })
  verificationStatus: VerificationStatus = VerificationStatus.UNVERIFIED;
  @ApiPropertyOptional({ default: false }) isPrimary = false;
  @ApiPropertyOptional({ nullable: true, format: 'date' }) validFrom?: Date | null;
  @ApiPropertyOptional({ nullable: true, format: 'date' }) validTo?: Date | null;
  @ApiPropertyOptional({ nullable: true, format: 'uuid' }) sourceDocumentId?: string | null;
  @ApiPropertyOptional({ nullable: true }) sourceReference?: string | null;
  @ApiPropertyOptional({ nullable: true, format: 'date-time' }) verifiedAt?: Date | null;
}

export class UpdateExternalIdentifierDto {
  static readonly schema = externalIdentifierFields
    .pick({
      value: true,
      verificationStatus: true,
      isPrimary: true,
      validFrom: true,
      validTo: true,
      sourceDocumentId: true,
      sourceReference: true,
      verifiedAt: true,
    })
    .partial()
    .strict()
    .superRefine(validateDates);
  @ApiPropertyOptional() value?: string;
  @ApiPropertyOptional({ enum: VerificationStatus }) verificationStatus?: VerificationStatus;
  @ApiPropertyOptional() isPrimary?: boolean;
  @ApiPropertyOptional({ nullable: true }) validFrom?: Date | null;
  @ApiPropertyOptional({ nullable: true }) validTo?: Date | null;
  @ApiPropertyOptional({ nullable: true }) sourceDocumentId?: string | null;
  @ApiPropertyOptional({ nullable: true }) sourceReference?: string | null;
  @ApiPropertyOptional({ nullable: true }) verifiedAt?: Date | null;
}

import { PublicationStatus, RecordStatus, VerificationStatus } from '@prisma/client';
import { z } from 'zod';

export const uuidSchema = z.uuid();
export const requiredString = (max: number): z.ZodString => z.string().trim().min(1).max(max);
export const nullableString = (max: number): z.ZodNullable<z.ZodString> =>
  z.string().trim().max(max).nullable();
export const recordStatusSchema = z.enum(RecordStatus);
export const publicationStatusSchema = z.enum(PublicationStatus);
export const verificationStatusSchema = z.enum(VerificationStatus);

export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected date in YYYY-MM-DD format')
  .transform((value, context) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
      context.addIssue({ code: 'custom', message: 'Invalid calendar date' });
      return z.NEVER;
    }
    return date;
  });

export const nullableDateStringSchema = dateStringSchema.nullable();
export const sortOrderSchema = z.enum(['asc', 'desc']).default('asc');
export const archivedSchema = z.enum(['true', 'false', 'all']).default('false');

export const boundedDecimalSchema = z.coerce
  .number()
  .min(-1_000_000_000_000)
  .max(1_000_000_000_000);
export const nonNegativeDecimalSchema = z.coerce.number().min(0).max(1_000_000_000_000);

export function ensureDateOrder(
  value: {
    startDate?: Date | null | undefined;
    endDate?: Date | null | undefined;
  },
  context: z.RefinementCtx,
): void {
  if (value.startDate && value.endDate && value.endDate < value.startDate) {
    context.addIssue({
      code: 'custom',
      path: ['endDate'],
      message: 'endDate must not be earlier than startDate',
    });
  }
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

const passwordSchema = z.string().min(12).max(200);
const otpSchema = z.string().regex(/^\d{6}$/, 'otp must contain exactly six digits');

export class LoginDto {
  static readonly schema = z
    .object({
      // Portfolio mode intentionally accepts the public username in this field.
      // Normal mode still validates the identifier in AuthService before lookup.
      email: z
        .string()
        .trim()
        .min(1)
        .max(254)
        .transform((value) => value.toLowerCase()),
      password: z.string().min(1).max(200),
      otp: otpSchema.optional(),
      recoveryCode: z.string().trim().min(8).max(64).optional(),
    })
    .strict();

  @ApiProperty({ format: 'email', example: 'admin@example.invalid' })
  email!: string;

  @ApiProperty({ format: 'password', minLength: 1, maxLength: 200 })
  password!: string;

  @ApiPropertyOptional({ pattern: '^\\d{6}$', example: '123456' })
  otp?: string;

  @ApiPropertyOptional({ minLength: 8, maxLength: 64 })
  recoveryCode?: string;
}

export class ChangePasswordDto {
  static readonly schema = z
    .object({
      currentPassword: z.string().min(1).max(200),
      newPassword: passwordSchema,
      otp: otpSchema,
    })
    .strict()
    .refine((value) => value.currentPassword !== value.newPassword, {
      path: ['newPassword'],
      message: 'newPassword must differ from currentPassword',
    });

  @ApiProperty({ format: 'password', maxLength: 200 })
  currentPassword!: string;

  @ApiProperty({ format: 'password', minLength: 12, maxLength: 200 })
  newPassword!: string;

  @ApiProperty({ pattern: '^\\d{6}$' })
  otp!: string;
}

export class RotateRecoveryCodesDto {
  static readonly schema = z.object({ otp: otpSchema }).strict();

  @ApiProperty({ pattern: '^\\d{6}$' })
  otp!: string;
}

export class StartTotpReenrollmentDto {
  static readonly schema = z.object({ currentPassword: z.string().min(1).max(200) }).strict();

  @ApiProperty({ format: 'password', maxLength: 200 })
  currentPassword!: string;
}

export class ConfirmTotpReenrollmentDto {
  static readonly schema = z.object({ otp: otpSchema }).strict();

  @ApiProperty({ pattern: '^\\d{6}$' })
  otp!: string;
}

import { z } from 'zod';

const corsOriginsSchema = z
  .string()
  .trim()
  .default('')
  .superRefine((value, context) => {
    for (const origin of value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)) {
      if (origin === '*') {
        context.addIssue({
          code: 'custom',
          message: 'CORS_ALLOWED_ORIGINS must not contain a wildcard',
        });
        continue;
      }
      try {
        const url = new URL(origin);
        if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) {
          throw new Error('Origin must contain only scheme, host and optional port');
        }
      } catch {
        context.addIssue({
          code: 'custom',
          message: `CORS_ALLOWED_ORIGINS contains an invalid origin: ${origin}`,
        });
      }
    }
  });

const booleanStringSchema = z.enum(['true', 'false']).transform((value) => value === 'true');

export const environmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']),
    PORT: z.coerce.number().int().min(1).max(65_535),
    DATABASE_URL: z
      .string()
      .min(1)
      .startsWith('postgresql://', 'DATABASE_URL must use the postgresql:// protocol'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']),
    API_PREFIX: z
      .string()
      .trim()
      .min(1)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i, 'API_PREFIX must be a URL path segment'),
    CORS_ALLOWED_ORIGINS: corsOriginsSchema,
    AUTH_ENCRYPTION_KEY: z
      .string()
      .regex(/^[a-f0-9]{64}$/i, 'AUTH_ENCRYPTION_KEY must be exactly 32 bytes encoded as hex'),
    AUTH_COOKIE_NAME: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9_-]{1,64}$/)
      .default('fem_admin_session'),
    AUTH_SESSION_TTL_MINUTES: z.coerce.number().int().min(15).max(1440).default(480),
    AUTH_SESSION_IDLE_MINUTES: z.coerce.number().int().min(5).max(240).default(30),
    AUTH_MAX_FAILED_ATTEMPTS: z.coerce.number().int().min(3).max(20).default(5),
    AUTH_LOCKOUT_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),
    HSTS_ENABLED: booleanStringSchema.default(false),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
    RATE_LIMIT_DEFAULT_PER_MINUTE: z.coerce.number().int().min(1).max(100_000).default(120),
    RATE_LIMIT_AUTH_PER_MINUTE: z.coerce.number().int().min(1).max(1_000).default(5),
    RATE_LIMIT_ADMIN_PER_MINUTE: z.coerce.number().int().min(1).max(100_000).default(300),
    RATE_LIMIT_PUBLIC_PER_MINUTE: z.coerce.number().int().min(1).max(100_000).default(600),
    RATE_LIMIT_SEARCH_PER_MINUTE: z.coerce.number().int().min(1).max(100_000).default(120),
    RATE_LIMIT_FILES_PER_MINUTE: z.coerce.number().int().min(1).max(100_000).default(60),
    RATE_LIMIT_INTEGRATIONS_PER_MINUTE: z.coerce.number().int().min(1).max(100_000).default(300),
    SWAGGER_ENABLED: booleanStringSchema.default(true),
    SWAGGER_USERNAME: z.string().trim().min(1).optional(),
    SWAGGER_PASSWORD: z.string().min(16).optional(),
  })
  .superRefine((value, context) => {
    if (value.NODE_ENV === 'production' && value.CORS_ALLOWED_ORIGINS.length === 0) {
      context.addIssue({
        code: 'custom',
        path: ['CORS_ALLOWED_ORIGINS'],
        message: 'CORS_ALLOWED_ORIGINS is required in production',
      });
    }
    if (value.NODE_ENV === 'production') {
      for (const origin of value.CORS_ALLOWED_ORIGINS.split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)) {
        let protocol: string;
        try {
          protocol = new URL(origin).protocol;
        } catch {
          continue;
        }
        if (protocol !== 'https:') {
          context.addIssue({
            code: 'custom',
            path: ['CORS_ALLOWED_ORIGINS'],
            message: 'Production CORS origins must use HTTPS',
          });
        }
      }
      if (
        value.SWAGGER_ENABLED &&
        (value.SWAGGER_USERNAME === undefined || value.SWAGGER_PASSWORD === undefined)
      ) {
        context.addIssue({
          code: 'custom',
          path: ['SWAGGER_ENABLED'],
          message: 'Production Swagger requires SWAGGER_USERNAME and SWAGGER_PASSWORD',
        });
      }
    }
    if (value.AUTH_SESSION_IDLE_MINUTES > value.AUTH_SESSION_TTL_MINUTES) {
      context.addIssue({
        code: 'custom',
        path: ['AUTH_SESSION_IDLE_MINUTES'],
        message: 'AUTH_SESSION_IDLE_MINUTES must not exceed AUTH_SESSION_TTL_MINUTES',
      });
    }
  });

export type Environment = z.infer<typeof environmentSchema>;

export function validateEnvironment(config: Record<string, unknown>): Environment {
  const result = environmentSchema.safeParse(config);

  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`);
  }

  return result.data;
}

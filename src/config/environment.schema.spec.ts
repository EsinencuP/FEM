import { validateEnvironment } from './environment.schema';

describe('environment configuration', () => {
  it('fails fast when required variables are missing', () => {
    expect(() => validateEnvironment({})).toThrow('Invalid environment configuration');
  });

  it('parses a complete configuration and coerces the port', () => {
    expect(
      validateEnvironment({
        NODE_ENV: 'test',
        PORT: '3000',
        DATABASE_URL: 'postgresql://user:password@localhost:5432/database?schema=public',
        LOG_LEVEL: 'silent',
        API_PREFIX: 'api',
        AUTH_ENCRYPTION_KEY: '0'.repeat(64),
      }),
    ).toEqual({
      NODE_ENV: 'test',
      PORT: 3000,
      DATABASE_URL: 'postgresql://user:password@localhost:5432/database?schema=public',
      LOG_LEVEL: 'silent',
      API_PREFIX: 'api',
      CORS_ALLOWED_ORIGINS: '',
      AUTH_ENCRYPTION_KEY: '0'.repeat(64),
      AUTH_COOKIE_NAME: 'fem_admin_session',
      AUTH_SESSION_TTL_MINUTES: 480,
      AUTH_SESSION_IDLE_MINUTES: 30,
      AUTH_MAX_FAILED_ATTEMPTS: 5,
      AUTH_LOCKOUT_MINUTES: 15,
      SWAGGER_ENABLED: true,
    });
  });

  it('rejects wildcard and malformed CORS origins', () => {
    const base = {
      NODE_ENV: 'test',
      PORT: '3000',
      DATABASE_URL: 'postgresql://user:password@localhost:5432/database?schema=public',
      LOG_LEVEL: 'silent',
      API_PREFIX: 'api',
      AUTH_ENCRYPTION_KEY: '0'.repeat(64),
    };

    expect(() => validateEnvironment({ ...base, CORS_ALLOWED_ORIGINS: '*' })).toThrow(
      'CORS_ALLOWED_ORIGINS',
    );
    expect(() =>
      validateEnvironment({ ...base, CORS_ALLOWED_ORIGINS: 'localhost:5173/path' }),
    ).toThrow('CORS_ALLOWED_ORIGINS');
  });

  it('requires an explicit CORS allowlist in production', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'production',
        PORT: '3000',
        DATABASE_URL: 'postgresql://user:password@localhost:5432/database?schema=public',
        LOG_LEVEL: 'info',
        API_PREFIX: 'api',
        AUTH_ENCRYPTION_KEY: '0'.repeat(64),
        SWAGGER_ENABLED: 'false',
      }),
    ).toThrow('CORS_ALLOWED_ORIGINS is required in production');
  });

  it('requires HTTPS CORS origins in production', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'production',
        PORT: '3000',
        DATABASE_URL: 'postgresql://user:password@localhost:5432/database?schema=public',
        LOG_LEVEL: 'info',
        API_PREFIX: 'api',
        CORS_ALLOWED_ORIGINS: 'http://frontend.example',
        AUTH_ENCRYPTION_KEY: '0'.repeat(64),
        SWAGGER_ENABLED: 'false',
      }),
    ).toThrow('Production CORS origins must use HTTPS');
  });
});

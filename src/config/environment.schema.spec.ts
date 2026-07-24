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
      HSTS_ENABLED: false,
      TRUST_PROXY_HOPS: 0,
      RATE_LIMIT_DEFAULT_PER_MINUTE: 120,
      RATE_LIMIT_AUTH_PER_MINUTE: 5,
      RATE_LIMIT_ADMIN_PER_MINUTE: 300,
      RATE_LIMIT_PUBLIC_PER_MINUTE: 600,
      RATE_LIMIT_SEARCH_PER_MINUTE: 120,
      RATE_LIMIT_FILES_PER_MINUTE: 60,
      RATE_LIMIT_INTEGRATIONS_PER_MINUTE: 300,
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

  it('fails closed for incomplete production Swagger and invalid session settings', () => {
    const base = {
      NODE_ENV: 'production',
      PORT: '3000',
      DATABASE_URL: 'postgresql://user:password@localhost:5432/database?schema=public',
      LOG_LEVEL: 'info',
      API_PREFIX: 'api',
      CORS_ALLOWED_ORIGINS: 'https://frontend.example',
      AUTH_ENCRYPTION_KEY: '0'.repeat(64),
    };

    expect(() => validateEnvironment(base)).toThrow(
      'Production Swagger requires SWAGGER_USERNAME and SWAGGER_PASSWORD',
    );
    expect(() =>
      validateEnvironment({
        ...base,
        SWAGGER_ENABLED: 'false',
        AUTH_SESSION_TTL_MINUTES: '15',
        AUTH_SESSION_IDLE_MINUTES: '30',
      }),
    ).toThrow('AUTH_SESSION_IDLE_MINUTES must not exceed AUTH_SESSION_TTL_MINUTES');
    expect(() =>
      validateEnvironment({
        ...base,
        SWAGGER_ENABLED: 'false',
        TRUST_PROXY_HOPS: '6',
      }),
    ).toThrow('TRUST_PROXY_HOPS');
  });
});

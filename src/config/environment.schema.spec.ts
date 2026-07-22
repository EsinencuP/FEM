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
      }),
    ).toEqual({
      NODE_ENV: 'test',
      PORT: 3000,
      DATABASE_URL: 'postgresql://user:password@localhost:5432/database?schema=public',
      LOG_LEVEL: 'silent',
      API_PREFIX: 'api',
    });
  });
});

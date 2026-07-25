import {
  assertSafeDemoSeedEnvironment,
  assertSafeTestDatabaseEnvironment,
  remoteDemoDatabaseConfirmation,
} from './database-safety';

describe('database target safety', () => {
  const testEnv = (databaseUrl: string): NodeJS.ProcessEnv => ({
    NODE_ENV: 'test',
    DATABASE_URL: databaseUrl,
  });

  it.each([
    'postgresql://user:password@localhost:5432/equestrian_federation_test',
    'postgresql://user:password@127.0.0.1:5432/fem_audit_20260723',
    'postgresql://user:password@localhost:5432/ci_database?schema=public',
  ])('allows an explicitly named local test database: %s', (databaseUrl) => {
    expect(() => {
      assertSafeTestDatabaseEnvironment(testEnv(databaseUrl));
    }).not.toThrow();
  });

  it.each([
    'postgresql://user:password@localhost:5432/equestrian_federation',
    'postgresql://user:password@db.example.test:5432/ci_database',
    'postgresql://user:password@10.0.0.8:5432/fem_audit_remote',
    'not-a-url',
  ])('rejects an unsafe test database target: %s', (databaseUrl) => {
    expect(() => {
      assertSafeTestDatabaseEnvironment(testEnv(databaseUrl));
    }).toThrow();
  });

  it('requires NODE_ENV=test for mutating test suites', () => {
    expect(() => {
      assertSafeTestDatabaseEnvironment({
        NODE_ENV: 'development',
        DATABASE_URL: 'postgresql://user:password@localhost:5432/fem_audit_local',
      });
    }).toThrow(/NODE_ENV/);
  });

  it('allows demo seed only with an explicit local opt-in', () => {
    expect(() => {
      assertSafeDemoSeedEnvironment({
        NODE_ENV: 'development',
        ALLOW_DEMO_SEED: 'true',
        DATABASE_URL: 'postgresql://user:password@localhost:5432/equestrian_federation',
      });
    }).not.toThrow();
  });

  it.each([
    {
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://user:password@localhost:5432/equestrian_federation',
    },
    {
      NODE_ENV: 'production',
      ALLOW_DEMO_SEED: 'true',
      DATABASE_URL: 'postgresql://user:password@localhost:5432/equestrian_federation',
    },
    {
      NODE_ENV: 'test',
      ALLOW_DEMO_SEED: 'true',
      DATABASE_URL: 'postgresql://user:password@database.example.com:5432/ci_database',
    },
  ])('rejects unsafe demo seed environment %#', (environment) => {
    expect(() => {
      assertSafeDemoSeedEnvironment(environment);
    }).toThrow();
  });

  it('allows a remote demo seed only with TLS and an exact database-bound confirmation', () => {
    const databaseUrl =
      'postgresql://demo:secret@demo-pooler.example.test:5432/fem_showcase?sslmode=require';
    const confirmation = remoteDemoDatabaseConfirmation(databaseUrl);

    expect(() => {
      assertSafeDemoSeedEnvironment({
        NODE_ENV: 'development',
        ALLOW_DEMO_SEED: 'true',
        ALLOW_REMOTE_DEMO_SEED: 'true',
        REMOTE_DEMO_DATABASE_CONFIRMATION: confirmation,
        DATABASE_URL: databaseUrl,
      });
    }).not.toThrow();
  });

  it.each([
    'postgresql://demo:secret@demo.example.test:5432/fem_showcase',
    'postgresql://demo:secret@demo.example.test:5432/fem_production?sslmode=require',
  ])('rejects an unsafe remote demo seed target: %s', (databaseUrl) => {
    expect(() => {
      assertSafeDemoSeedEnvironment({
        NODE_ENV: 'development',
        ALLOW_DEMO_SEED: 'true',
        ALLOW_REMOTE_DEMO_SEED: 'true',
        REMOTE_DEMO_DATABASE_CONFIRMATION: remoteDemoDatabaseConfirmation(databaseUrl),
        DATABASE_URL: databaseUrl,
      });
    }).toThrow();
  });
});

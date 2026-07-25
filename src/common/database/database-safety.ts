import { createHash } from 'node:crypto';

interface DatabaseTarget {
  host: string;
  port: string;
  database: string;
  sslMode: string | null;
}

type EnvironmentLike = Readonly<Record<string, string | undefined>>;

const LOCAL_DATABASE_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const TEST_DATABASE_NAMES = new Set(['equestrian_federation_test', 'ci_database']);
const DEMO_DATABASE_NAMES = new Set([
  'equestrian_federation',
  'equestrian_federation_test',
  'ci_database',
]);
const AUDIT_DATABASE_PATTERN = /^fem_audit_[a-z0-9_-]+$/i;

function parseDatabaseTarget(databaseUrl: string | undefined): DatabaseTarget {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for database safety validation');
  }

  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL is malformed');
  }

  if (parsed.protocol !== 'postgresql:') {
    throw new Error('DATABASE_URL must use the postgresql protocol');
  }

  const database = decodeURIComponent(parsed.pathname).replace(/^\/+/, '');
  if (!database || database.includes('/')) {
    throw new Error('DATABASE_URL must identify exactly one database');
  }

  return {
    host: parsed.hostname.toLowerCase(),
    port: parsed.port || '5432',
    database,
    sslMode: parsed.searchParams.get('sslmode'),
  };
}

function assertLocalTarget(target: DatabaseTarget): void {
  if (!LOCAL_DATABASE_HOSTS.has(target.host)) {
    throw new Error('Database safety policy permits local PostgreSQL hosts only');
  }
}

function isTestDatabase(database: string): boolean {
  return TEST_DATABASE_NAMES.has(database) || AUDIT_DATABASE_PATTERN.test(database);
}

export function remoteDemoDatabaseConfirmation(databaseUrl: string | undefined): string {
  const target = parseDatabaseTarget(databaseUrl);
  return createHash('sha256')
    .update(`FEM_REMOTE_DEMO:${target.host}:${target.port}/${target.database}`)
    .digest('hex');
}

export function assertSafeTestDatabaseEnvironment(environment: EnvironmentLike): void {
  if (environment.NODE_ENV !== 'test') {
    throw new Error('Mutating test suites require NODE_ENV=test');
  }

  const target = parseDatabaseTarget(environment.DATABASE_URL);
  assertLocalTarget(target);

  if (!isTestDatabase(target.database)) {
    throw new Error('Mutating test suites require an explicitly named test or audit database');
  }
}

export function assertSafeDemoSeedEnvironment(environment: EnvironmentLike): void {
  if (environment.NODE_ENV === 'production') {
    throw new Error('Demo seed is forbidden when NODE_ENV=production');
  }
  if (environment.NODE_ENV !== 'development' && environment.NODE_ENV !== 'test') {
    throw new Error('Demo seed requires NODE_ENV=development or NODE_ENV=test');
  }
  if (environment.ALLOW_DEMO_SEED !== 'true') {
    throw new Error('Demo seed requires explicit ALLOW_DEMO_SEED=true opt-in');
  }

  const target = parseDatabaseTarget(environment.DATABASE_URL);
  if (!LOCAL_DATABASE_HOSTS.has(target.host)) {
    if (environment.ALLOW_REMOTE_DEMO_SEED !== 'true') {
      throw new Error('Remote demo seed requires explicit ALLOW_REMOTE_DEMO_SEED=true opt-in');
    }
    if (target.sslMode !== 'require' && target.sslMode !== 'verify-full') {
      throw new Error('Remote demo seed requires sslmode=require or sslmode=verify-full');
    }
    if (/(?:^|[_-])(prod|production|live)(?:$|[_-])/i.test(target.database)) {
      throw new Error('Remote demo seed refuses a production-like database name');
    }
    const expectedConfirmation = remoteDemoDatabaseConfirmation(environment.DATABASE_URL);
    if (environment.REMOTE_DEMO_DATABASE_CONFIRMATION !== expectedConfirmation) {
      throw new Error('Remote demo seed requires the exact database-bound confirmation token');
    }
    return;
  }

  if (!DEMO_DATABASE_NAMES.has(target.database) && !AUDIT_DATABASE_PATTERN.test(target.database)) {
    throw new Error('Demo seed target is not an approved local database');
  }
}

import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { resolve } from 'node:path';

import { PrismaClient } from '@prisma/client';

import { assertSafeTestDatabaseEnvironment } from '../src/common/database/database-safety';

const RUNTIME_ROLE_PATTERN = /^fem_runtime_[a-f0-9]{16}$/;
const STARTUP_ATTEMPTS = 20;
const STARTUP_DELAY_MS = 500;

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

async function stopChild(child: ChildProcess | undefined): Promise<void> {
  if (child?.exitCode !== null) return;
  child.kill('SIGTERM');
  const exited = await Promise.race([
    once(child, 'exit').then(() => true),
    delay(5_000).then(() => false),
  ]);
  if (!exited) child.kill('SIGKILL');
}

async function expectStatus(url: string, status: number): Promise<Response> {
  const response = await fetch(url);
  if (response.status !== status) {
    throw new Error(`Runtime smoke expected HTTP ${status} from ${url}`);
  }
  return response;
}

async function expectDatabaseDenial(
  label: string,
  operation: () => Promise<unknown>,
): Promise<void> {
  try {
    await operation();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (/permission denied|must be owner/i.test(message)) return;
    throw new Error(`${label} failed for an unexpected reason`);
  }
  throw new Error(`${label} unexpectedly succeeded`);
}

async function findAvailablePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolveListening, rejectListening) => {
    server.once('error', rejectListening);
    server.listen(0, '127.0.0.1', resolveListening);
  });
  const address = server.address();
  await new Promise<void>((resolveClose, rejectClose) => {
    server.close((error) => {
      if (error) rejectClose(error);
      else resolveClose();
    });
  });
  if (!address || typeof address === 'string') throw new Error('Unable to allocate smoke port');
  return address.port;
}

async function main(): Promise<void> {
  assertSafeTestDatabaseEnvironment(process.env);
  const ownerUrl = process.env.DATABASE_URL;
  if (!ownerUrl) throw new Error('DATABASE_URL is required');

  const owner = new PrismaClient({ datasourceUrl: ownerUrl });
  const suffix = randomUUID().replaceAll('-', '');
  const loginRole = `fem_runtime_smoke_${suffix}`;
  const password = randomBytes(32).toString('hex');
  const port = await findAvailablePort();
  let child: ChildProcess | undefined;
  let runtime: PrismaClient | undefined;
  let capabilityRole: string | undefined;
  let disciplineId: string | undefined;
  const revokedPublicConnectDatabases: string[] = [];
  let loginCreated = false;
  let capabilityGranted = false;
  let childError = '';

  try {
    await owner.$connect();
    const [capability] = await owner.$queryRaw<{ name: string }[]>`
      SELECT 'fem_runtime_' || substring(md5(current_database()), 1, 16) AS name
    `;
    if (!capability || !RUNTIME_ROLE_PATTERN.test(capability.name)) {
      throw new Error('Database-scoped runtime capability role is missing or malformed');
    }
    capabilityRole = capability.name;

    await owner.$executeRawUnsafe(
      `CREATE ROLE "${loginRole}" LOGIN PASSWORD '${password}' ` +
        'NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS',
    );
    loginCreated = true;
    await owner.$executeRawUnsafe(
      `GRANT "${capabilityRole}" TO "${loginRole}" ` + 'WITH ADMIN FALSE, INHERIT TRUE, SET FALSE',
    );
    capabilityGranted = true;
    const otherDatabases = await owner.$queryRaw<{ name: string }[]>`
      SELECT datname AS name
      FROM pg_database
      WHERE datallowconn = true
        AND datname <> current_database()
        AND has_database_privilege(${loginRole}, oid, 'CONNECT')
      ORDER BY datname
    `;
    for (const database of otherDatabases) {
      const safeDatabaseName = database.name.replaceAll('"', '""');
      await owner.$executeRawUnsafe(`REVOKE CONNECT ON DATABASE "${safeDatabaseName}" FROM PUBLIC`);
      revokedPublicConnectDatabases.push(database.name);
    }

    const runtimeUrl = new URL(ownerUrl);
    runtimeUrl.username = loginRole;
    runtimeUrl.password = password;
    const runtimeClient = new PrismaClient({ datasourceUrl: runtimeUrl.toString() });
    runtime = runtimeClient;
    await runtimeClient.$connect();
    await runtimeClient.country.findFirst();
    const discipline = await runtimeClient.discipline.create({
      data: {
        code: `SMOKE_${suffix.slice(0, 20)}`,
        name: 'Restricted runtime smoke fixture',
        isDemo: true,
      },
    });
    disciplineId = discipline.id;
    await runtimeClient.discipline.update({
      where: { id: discipline.id },
      data: { description: 'Allowed runtime update verified' },
    });
    await expectDatabaseDenial('Athlete DELETE privilege probe', () =>
      runtimeClient.athlete.deleteMany(),
    );
    await expectDatabaseDenial('CompetitionResult TRUNCATE privilege probe', () =>
      runtimeClient.$executeRawUnsafe('TRUNCATE TABLE "CompetitionResult"'),
    );
    await expectDatabaseDenial('Athlete trigger privilege probe', () =>
      runtimeClient.$executeRawUnsafe('ALTER TABLE "Athlete" DISABLE TRIGGER ALL'),
    );
    await expectDatabaseDenial('Migration history privilege probe', () =>
      runtimeClient.$queryRawUnsafe('SELECT * FROM "_prisma_migrations"'),
    );

    child = spawn(process.execPath, [resolve('dist/src/main.js')], {
      cwd: process.cwd(),
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'pipe'],
      env: {
        ...process.env,
        DATABASE_URL: runtimeUrl.toString(),
        NODE_ENV: 'production',
        PORT: String(port),
        API_PREFIX: 'api',
        LOG_LEVEL: 'silent',
        CORS_ALLOWED_ORIGINS: 'https://admin.example.test',
        AUTH_ENCRYPTION_KEY: randomBytes(32).toString('hex'),
        HSTS_ENABLED: 'false',
        TRUST_PROXY_HOPS: '0',
        SWAGGER_ENABLED: 'false',
      },
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      childError = `${childError}${chunk.toString('utf8')}`.slice(-4_000);
    });

    let health: Response | undefined;
    for (let attempt = 0; attempt < STARTUP_ATTEMPTS; attempt += 1) {
      if (child.exitCode !== null) break;
      await delay(STARTUP_DELAY_MS);
      try {
        health = await expectStatus(`http://127.0.0.1:${port}/api/health`, 200);
        break;
      } catch {
        // The bounded retry loop distinguishes startup latency from failure.
      }
    }
    if (!health) {
      const safeDiagnostics = childError
        .replaceAll(password, '[REDACTED]')
        .replace(/postgres(?:ql)?:\/\/[^@\s]+@/gi, 'postgresql://[REDACTED]@');
      throw new Error(
        `Restricted production runtime did not become healthy: ${safeDiagnostics || 'no stderr'}`,
      );
    }
    const body: unknown = await health.json();
    if (
      typeof body !== 'object' ||
      body === null ||
      !('status' in body) ||
      body.status !== 'ok' ||
      !('database' in body) ||
      body.database !== 'connected'
    ) {
      throw new Error('Restricted production health payload is invalid');
    }

    await expectStatus(`http://127.0.0.1:${port}/api/v1/admin/athletes`, 401);
    const publicResponse = await expectStatus(
      `http://127.0.0.1:${port}/api/v1/public/ro/countries`,
      200,
    );
    const publicBody: unknown = await publicResponse.json();
    if (
      typeof publicBody !== 'object' ||
      publicBody === null ||
      !('data' in publicBody) ||
      !Array.isArray(publicBody.data) ||
      !('meta' in publicBody)
    ) {
      throw new Error('Restricted production Public API payload is invalid');
    }
    await expectStatus(`http://127.0.0.1:${port}/api/docs`, 404);
    process.stdout.write(
      'Restricted production runtime smoke: domain DML=allowed destructive DML=denied ' +
        'health=200 public=200 admin=401 docs=404\n',
    );
  } finally {
    await stopChild(child);
    await runtime?.$disconnect();
    if (disciplineId) {
      await owner.discipline.delete({ where: { id: disciplineId } });
    }
    if (capabilityRole && capabilityGranted) {
      await owner.$executeRawUnsafe(`REVOKE "${capabilityRole}" FROM "${loginRole}"`);
    }
    if (loginCreated) await owner.$executeRawUnsafe(`DROP ROLE IF EXISTS "${loginRole}"`);
    for (const databaseName of revokedPublicConnectDatabases) {
      const safeDatabaseName = databaseName.replaceAll('"', '""');
      await owner.$executeRawUnsafe(`GRANT CONNECT ON DATABASE "${safeDatabaseName}" TO PUBLIC`);
    }
    await owner.$disconnect();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown runtime smoke failure';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});

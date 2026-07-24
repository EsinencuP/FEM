import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';

import { PrismaClient } from '@prisma/client';

import { assertSafeTestDatabaseEnvironment } from '../src/common/database/database-safety';

describe('runtime capability migration preflight', () => {
  it('fails closed for a malicious pre-existing database-scoped role', async () => {
    assertSafeTestDatabaseEnvironment(process.env);
    const ownerUrl = process.env.DATABASE_URL;
    if (!ownerUrl) throw new Error('DATABASE_URL is required');

    const suffix = randomUUID().replaceAll('-', '').slice(0, 8);
    const databaseName = `fem_audit_role_preflight_${suffix}`;
    const capabilityName = `fem_runtime_${createHash('md5')
      .update(databaseName)
      .digest('hex')
      .slice(0, 16)}`;
    const adminUrl = new URL(ownerUrl);
    adminUrl.pathname = '/postgres';
    const testUrl = new URL(ownerUrl);
    testUrl.pathname = `/${databaseName}`;
    const admin = new PrismaClient({ datasourceUrl: adminUrl.toString() });
    let databaseCreated = false;
    let roleCreated = false;

    try {
      await admin.$connect();
      await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
      databaseCreated = true;
      await admin.$executeRawUnsafe(
        `CREATE ROLE "${capabilityName}" LOGIN NOSUPERUSER NOCREATEDB ` +
          'NOCREATEROLE NOREPLICATION NOBYPASSRLS',
      );
      roleCreated = true;

      const migration = spawnSync(
        process.execPath,
        [
          require.resolve('prisma/build/index.js'),
          'migrate',
          'deploy',
          '--schema',
          'prisma/schema.prisma',
        ],
        {
          cwd: process.cwd(),
          encoding: 'utf8',
          timeout: 30_000,
          windowsHide: true,
          env: { ...process.env, DATABASE_URL: testUrl.toString() },
        },
      );
      expect(migration.status).not.toBe(0);
      expect(`${migration.stdout}${migration.stderr}`).toContain(
        'Refusing unexpected pre-existing database runtime capability role',
      );
      const partialDatabase = new PrismaClient({ datasourceUrl: testUrl.toString() });
      try {
        const [privileges] = await partialDatabase.$queryRaw<
          {
            migrationSelect: boolean;
            permissionInsert: boolean;
            auditUpdate: boolean;
          }[]
        >`
          SELECT
            has_table_privilege(${capabilityName}, 'public._prisma_migrations', 'SELECT')
              AS "migrationSelect",
            has_table_privilege(${capabilityName}, 'public."Permission"', 'INSERT')
              AS "permissionInsert",
            has_table_privilege(${capabilityName}, 'public."AuditLog"', 'UPDATE')
              AS "auditUpdate"
        `;
        expect(privileges).toEqual({
          migrationSelect: false,
          permissionInsert: false,
          auditUpdate: false,
        });
      } finally {
        await partialDatabase.$disconnect();
      }
    } finally {
      if (databaseCreated) {
        await admin.$executeRawUnsafe(
          `SELECT pg_terminate_backend(pid) FROM pg_stat_activity ` +
            `WHERE datname = '${databaseName}' AND pid <> pg_backend_pid()`,
        );
        await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${databaseName}"`);
      }
      if (roleCreated) {
        await admin.$executeRawUnsafe(`DROP ROLE IF EXISTS "${capabilityName}"`);
      }
      await admin.$disconnect();
    }
  }, 45_000);

  it('rejects a pre-existing capability with object ownership or default ACL', async () => {
    assertSafeTestDatabaseEnvironment(process.env);
    const ownerUrl = process.env.DATABASE_URL;
    if (!ownerUrl) throw new Error('DATABASE_URL is required');

    const suffix = randomUUID().replaceAll('-', '').slice(0, 8);
    const databaseName = `fem_audit_role_owner_${suffix}`;
    const capabilityName = `fem_runtime_${createHash('md5')
      .update(databaseName)
      .digest('hex')
      .slice(0, 16)}`;
    const adminUrl = new URL(ownerUrl);
    adminUrl.pathname = '/postgres';
    const testUrl = new URL(ownerUrl);
    testUrl.pathname = `/${databaseName}`;
    const admin = new PrismaClient({ datasourceUrl: adminUrl.toString() });
    let databaseCreated = false;
    let roleCreated = false;
    let testDatabase: PrismaClient | undefined;

    try {
      await admin.$connect();
      await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
      databaseCreated = true;
      await admin.$executeRawUnsafe(
        `CREATE ROLE "${capabilityName}" NOLOGIN NOSUPERUSER NOCREATEDB ` +
          'NOCREATEROLE NOREPLICATION NOBYPASSRLS',
      );
      roleCreated = true;
      testDatabase = new PrismaClient({ datasourceUrl: testUrl.toString() });
      await testDatabase.$executeRawUnsafe(`ALTER SCHEMA public OWNER TO "${capabilityName}"`);
      await testDatabase.$executeRawUnsafe(
        `ALTER DEFAULT PRIVILEGES GRANT SELECT ON TABLES TO "${capabilityName}"`,
      );

      const migration = spawnSync(
        process.execPath,
        [
          require.resolve('prisma/build/index.js'),
          'migrate',
          'deploy',
          '--schema',
          'prisma/schema.prisma',
        ],
        {
          cwd: process.cwd(),
          encoding: 'utf8',
          timeout: 30_000,
          windowsHide: true,
          env: { ...process.env, DATABASE_URL: testUrl.toString() },
        },
      );
      expect(migration.status).not.toBe(0);
      expect(`${migration.stdout}${migration.stderr}`).toContain(
        'Refusing unexpected pre-existing database runtime capability role',
      );
    } finally {
      await testDatabase?.$disconnect();
      if (databaseCreated) {
        await admin.$executeRawUnsafe(
          `SELECT pg_terminate_backend(pid) FROM pg_stat_activity ` +
            `WHERE datname = '${databaseName}' AND pid <> pg_backend_pid()`,
        );
        await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${databaseName}"`);
      }
      if (roleCreated) {
        await admin.$executeRawUnsafe(`DROP ROLE IF EXISTS "${capabilityName}"`);
      }
      await admin.$disconnect();
    }
  }, 45_000);
});

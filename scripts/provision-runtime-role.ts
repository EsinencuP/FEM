import { PrismaClient } from '@prisma/client';

const ROLE_PATTERN = /^[a-z][a-z0-9_]{2,62}$/;

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function quotedIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function quotedLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

async function provisionRuntimeRole(): Promise<void> {
  if (process.env.ALLOW_RUNTIME_ROLE_PROVISION !== 'true') {
    throw new Error(
      'Set ALLOW_RUNTIME_ROLE_PROVISION=true only for an intentional demo deployment',
    );
  }
  const adminDatabaseUrl = requiredEnvironment('ADMIN_DATABASE_URL');
  const runtimeUser = requiredEnvironment('RUNTIME_DATABASE_USER');
  const runtimePassword = requiredEnvironment('RUNTIME_DATABASE_PASSWORD');
  if (!ROLE_PATTERN.test(runtimeUser)) {
    throw new Error('RUNTIME_DATABASE_USER must be a safe lowercase PostgreSQL role name');
  }
  if (runtimePassword.length < 24 || runtimePassword.length > 200) {
    throw new Error('RUNTIME_DATABASE_PASSWORD must contain 24 to 200 characters');
  }

  const prisma = new PrismaClient({ datasourceUrl: adminDatabaseUrl });
  try {
    await prisma.$connect();
    const [database] = await prisma.$queryRaw<
      { databaseName: string; capabilityRole: string; adminUser: string }[]
    >`
      SELECT
        current_database() AS "databaseName",
        'fem_runtime_' || substring(md5(current_database()), 1, 16) AS "capabilityRole",
        current_user AS "adminUser"
    `;
    if (!database) throw new Error('Could not resolve the target database');

    const [capability] = await prisma.$queryRawUnsafe<
      {
        rolcanlogin: boolean;
        rolsuper: boolean;
        rolcreatedb: boolean;
        rolcreaterole: boolean;
        rolreplication: boolean;
        rolbypassrls: boolean;
      }[]
    >(
      `SELECT rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolreplication, ` +
        `rolbypassrls FROM pg_roles WHERE rolname = ${quotedLiteral(database.capabilityRole)}`,
    );
    if (
      !capability ||
      capability.rolcanlogin ||
      capability.rolsuper ||
      capability.rolcreatedb ||
      capability.rolcreaterole ||
      capability.rolreplication ||
      capability.rolbypassrls
    ) {
      throw new Error('The migration-created restricted runtime capability is missing or unsafe');
    }

    const [existing] = await prisma.$queryRawUnsafe<
      {
        rolcanlogin: boolean;
        rolinherit: boolean;
        rolsuper: boolean;
        rolcreatedb: boolean;
        rolcreaterole: boolean;
        rolreplication: boolean;
        rolbypassrls: boolean;
      }[]
    >(
      `SELECT rolcanlogin, rolinherit, rolsuper, rolcreatedb, rolcreaterole, ` +
        `rolreplication, rolbypassrls FROM pg_roles WHERE rolname = ${quotedLiteral(runtimeUser)}`,
    );
    if (
      existing &&
      (!existing.rolcanlogin ||
        !existing.rolinherit ||
        existing.rolsuper ||
        existing.rolcreatedb ||
        existing.rolcreaterole ||
        existing.rolreplication ||
        existing.rolbypassrls)
    ) {
      throw new Error('Refusing to reuse an existing runtime role with unsafe attributes');
    }

    const unexpectedMemberships = await prisma.$queryRawUnsafe<{ roleName: string }[]>(
      `SELECT granted.rolname AS "roleName" FROM pg_auth_members membership ` +
        `JOIN pg_roles member ON member.oid = membership.member ` +
        `JOIN pg_roles granted ON granted.oid = membership.roleid ` +
        `WHERE member.rolname = ${quotedLiteral(runtimeUser)} ` +
        `AND granted.rolname <> ${quotedLiteral(database.capabilityRole)}`,
    );
    if (unexpectedMemberships.length > 0) {
      throw new Error('Refusing a runtime role with unexpected role memberships');
    }

    if (existing) {
      await prisma.$executeRawUnsafe(
        `ALTER ROLE ${quotedIdentifier(runtimeUser)} WITH ` +
          `PASSWORD ${quotedLiteral(runtimePassword)}`,
      );
    } else {
      await prisma.$executeRawUnsafe(
        `CREATE ROLE ${quotedIdentifier(runtimeUser)} WITH LOGIN INHERIT ` +
          `NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS ` +
          `PASSWORD ${quotedLiteral(runtimePassword)}`,
      );
    }
    await prisma.$executeRawUnsafe(
      `GRANT ${quotedIdentifier(database.capabilityRole)} TO ${quotedIdentifier(runtimeUser)} ` +
        'WITH ADMIN FALSE, INHERIT TRUE, SET FALSE',
    );

    const adjacentDatabases = await prisma.$queryRawUnsafe<{ databaseName: string }[]>(
      `SELECT datname AS "databaseName" FROM pg_database ` +
        `WHERE datallowconn = true AND datname <> current_database() ` +
        `AND has_database_privilege(${quotedLiteral(runtimeUser)}, oid, 'CONNECT') ` +
        `AND NOT (` +
        `  datname IN ('postgres', 'template0', 'template1') ` +
        `  AND EXISTS (` +
        `    SELECT 1 FROM pg_roles WHERE rolname = 'neon_superuser'` +
        `  )` +
        `) ` +
        `ORDER BY datname`,
    );
    if (adjacentDatabases.length > 0) {
      throw new Error(
        `Runtime role can connect to adjacent databases: ${adjacentDatabases
          .map((row) => row.databaseName)
          .join(', ')}. Use a dedicated database project and revoke those CONNECT grants.`,
      );
    }

    process.stdout.write(
      `Restricted role ${runtimeUser} is ready for database ${database.databaseName}. ` +
        `Select this role when copying the pooled Neon DATABASE_URL.\n`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

void provisionRuntimeRole().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown runtime-role error';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});

import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

import { AppConfigService } from '../config/app-config.service';

interface RuntimeDatabaseSecurity {
  expectedRoleName: string;
  isExpectedRoleMember: boolean;
  expectedRoleIsRestricted: boolean;
  currentRoleIsRestricted: boolean;
  hasUnexpectedMembership: boolean;
  expectedRoleHasUnexpectedMembership: boolean;
  hasOtherDatabaseConnect: boolean;
  hasDangerousRuntimeSetting: boolean;
  canCreateDatabaseObjects: boolean;
  canCreateTemporaryObjects: boolean;
  hasDatabaseGrantOption: boolean;
  canCreateInPublic: boolean;
  hasSchemaGrantOption: boolean;
  hasUnexpectedSchemaAccess: boolean;
  ownsPublicObject: boolean;
  currentRoleHasDefaultAcl: boolean;
  expectedRoleOwnsObject: boolean;
  expectedRoleHasDefaultAcl: boolean;
  hasTablePrivilegeDrift: boolean;
  hasUnexpectedRelationPrivilege: boolean;
  hasTableGrantOption: boolean;
  hasColumnPrivilegeDrift: boolean;
  hasColumnGrantOption: boolean;
  hasUnexpectedExplicitAcl: boolean;
  hasSequencePrivilege: boolean;
  hasFunctionPrivilege: boolean;
  missingSchemaUsage: boolean;
  hasMigrationHistoryAccess: boolean;
  canUpdateAudit: boolean;
  canDeleteAudit: boolean;
  canTruncateAudit: boolean;
  canTriggerAudit: boolean;
  canMutatePermissionConfig: boolean;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly config: AppConfigService) {
    super({ datasourceUrl: config.databaseUrl });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    if (this.config.isProduction) await this.assertRestrictedRuntimeRole();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  private async assertRestrictedRuntimeRole(): Promise<void> {
    const [security] = await this.$queryRaw<RuntimeDatabaseSecurity[]>(Prisma.sql`
      SELECT
        expected.name AS "expectedRoleName",
        EXISTS (
          SELECT 1
          FROM pg_auth_members expected_membership
          WHERE expected_membership.member = role.oid
            AND expected_membership.roleid = expected_role.oid
            AND expected_membership.admin_option = false
            AND expected_membership.inherit_option = true
            AND expected_membership.set_option = false
        ) AS "isExpectedRoleMember",
        (
          expected_role.rolcanlogin = false
          AND expected_role.rolsuper = false
          AND expected_role.rolcreatedb = false
          AND expected_role.rolcreaterole = false
          AND expected_role.rolreplication = false
          AND expected_role.rolbypassrls = false
        ) AS "expectedRoleIsRestricted",
        (
          role.rolcanlogin = true
          AND role.rolinherit = true
          AND role.rolsuper = false
          AND role.rolcreatedb = false
          AND role.rolcreaterole = false
          AND role.rolreplication = false
          AND role.rolbypassrls = false
        ) AS "currentRoleIsRestricted",
        EXISTS (
          SELECT 1
          FROM pg_auth_members unexpected_membership
          WHERE unexpected_membership.member = role.oid
            AND unexpected_membership.roleid <> expected_role.oid
        ) AS "hasUnexpectedMembership",
        EXISTS (
          SELECT 1
          FROM pg_auth_members expected_role_membership
          WHERE expected_role_membership.member = expected_role.oid
            OR (
              expected_role_membership.roleid = expected_role.oid
              AND expected_role_membership.member <> role.oid
              AND NOT (
                EXISTS (
                  SELECT 1
                  FROM pg_roles neon_marker
                  WHERE neon_marker.rolname = 'neon_superuser'
                )
                AND expected_role_membership.member = (
                  SELECT database_owner.datdba
                  FROM pg_database database_owner
                  WHERE database_owner.datname = current_database()
                )
                AND expected_role_membership.admin_option = true
                AND expected_role_membership.inherit_option = false
                AND expected_role_membership.set_option = false
              )
            )
        ) AS "expectedRoleHasUnexpectedMembership",
        EXISTS (
          SELECT 1
          FROM pg_database other_database
          WHERE other_database.datallowconn = true
            AND other_database.datname <> current_database()
            AND has_database_privilege(
              current_user,
              other_database.oid,
              'CONNECT'
            )
            AND NOT (
              other_database.datname IN ('postgres', 'template0', 'template1')
              AND EXISTS (
                SELECT 1
                FROM pg_roles neon_marker
                WHERE neon_marker.rolname = 'neon_superuser'
              )
            )
        ) AS "hasOtherDatabaseConnect",
        current_setting('session_replication_role') <> 'origin'
          AS "hasDangerousRuntimeSetting",
        has_database_privilege(current_user, current_database(), 'CREATE')
          AS "canCreateDatabaseObjects",
        has_database_privilege(current_user, current_database(), 'TEMPORARY')
          AS "canCreateTemporaryObjects",
        (
          has_database_privilege(
            current_user,
            current_database(),
            'CONNECT WITH GRANT OPTION'
          )
          OR has_database_privilege(
            expected_role.oid,
            current_database(),
            'CONNECT WITH GRANT OPTION'
          )
        ) AS "hasDatabaseGrantOption",
        has_schema_privilege(current_user, 'public', 'CREATE') AS "canCreateInPublic",
        (
          has_schema_privilege(current_user, 'public', 'USAGE WITH GRANT OPTION')
          OR has_schema_privilege(
            expected_role.oid,
            'public',
            'USAGE WITH GRANT OPTION'
          )
        ) AS "hasSchemaGrantOption",
        EXISTS (
          SELECT 1
          FROM pg_namespace runtime_namespace
          WHERE runtime_namespace.nspname <> 'public'
            AND runtime_namespace.nspname NOT IN ('pg_catalog', 'information_schema')
            AND runtime_namespace.nspname NOT LIKE 'pg_toast%'
            AND runtime_namespace.nspname NOT LIKE 'pg_temp_%'
            AND (
              has_schema_privilege(current_user, runtime_namespace.oid, 'USAGE')
              OR has_schema_privilege(current_user, runtime_namespace.oid, 'CREATE')
              OR has_schema_privilege(expected_role.oid, runtime_namespace.oid, 'USAGE')
              OR has_schema_privilege(expected_role.oid, runtime_namespace.oid, 'CREATE')
            )
        ) AS "hasUnexpectedSchemaAccess",
        EXISTS (
          SELECT 1
          FROM pg_database
          WHERE datdba = role.oid
          UNION ALL
          SELECT 1 FROM pg_namespace WHERE nspowner = role.oid
          UNION ALL
          SELECT 1 FROM pg_class WHERE relowner = role.oid
          UNION ALL
          SELECT 1 FROM pg_proc WHERE proowner = role.oid
          UNION ALL
          SELECT 1 FROM pg_type WHERE typowner = role.oid
          UNION ALL
          SELECT 1 FROM pg_largeobject_metadata WHERE lomowner = role.oid
          UNION ALL
          SELECT 1 FROM pg_foreign_data_wrapper WHERE fdwowner = role.oid
          UNION ALL
          SELECT 1 FROM pg_foreign_server WHERE srvowner = role.oid
          UNION ALL
          SELECT 1 FROM pg_tablespace WHERE spcowner = role.oid
          UNION ALL
          SELECT 1 FROM pg_language WHERE lanowner = role.oid
        ) AS "ownsPublicObject",
        EXISTS (
          SELECT 1
          FROM pg_default_acl default_acl
          LEFT JOIN LATERAL aclexplode(default_acl.defaclacl) acl_entry ON true
          WHERE default_acl.defaclrole = role.oid
            OR acl_entry.grantee = role.oid
        ) AS "currentRoleHasDefaultAcl",
        (
          EXISTS (SELECT 1 FROM pg_database WHERE datdba = expected_role.oid)
          OR EXISTS (SELECT 1 FROM pg_namespace WHERE nspowner = expected_role.oid)
          OR EXISTS (SELECT 1 FROM pg_class WHERE relowner = expected_role.oid)
          OR EXISTS (SELECT 1 FROM pg_proc WHERE proowner = expected_role.oid)
          OR EXISTS (SELECT 1 FROM pg_type WHERE typowner = expected_role.oid)
          OR EXISTS (
            SELECT 1 FROM pg_largeobject_metadata WHERE lomowner = expected_role.oid
          )
          OR EXISTS (
            SELECT 1 FROM pg_foreign_data_wrapper WHERE fdwowner = expected_role.oid
          )
          OR EXISTS (
            SELECT 1 FROM pg_foreign_server WHERE srvowner = expected_role.oid
          )
          OR EXISTS (SELECT 1 FROM pg_tablespace WHERE spcowner = expected_role.oid)
          OR EXISTS (SELECT 1 FROM pg_language WHERE lanowner = expected_role.oid)
        ) AS "expectedRoleOwnsObject",
        EXISTS (
          SELECT 1
          FROM pg_default_acl default_acl
          LEFT JOIN LATERAL aclexplode(default_acl.defaclacl) acl_entry ON true
          WHERE default_acl.defaclrole = expected_role.oid
            OR acl_entry.grantee = expected_role.oid
        ) AS "expectedRoleHasDefaultAcl",
        EXISTS (
          SELECT 1
          FROM pg_class runtime_table
          JOIN pg_namespace runtime_table_namespace
            ON runtime_table_namespace.oid = runtime_table.relnamespace
          CROSS JOIN (
            VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'),
              ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')
          ) runtime_privilege(name)
          CROSS JOIN LATERAL (
            SELECT CASE
              WHEN runtime_privilege.name = 'SELECT'
                AND runtime_table.relname IN (
                  'ImportBatch', 'ImportRow', 'MediaFile', 'Document',
                  'ExternalIdentifier', 'Country', 'NationalFederation', 'Discipline',
                  'Club', 'ResultStatus', 'Athlete', 'Horse', 'Owner',
                  'AthleteClubMembership', 'AthleteHorseRelation', 'HorseOwnership',
                  'CompetitionEvent', 'CompetitionClass', 'CompetitionResult',
                  'ResultMetric', 'RankingDefinition', 'RankingRuleSet', 'RankingPeriod',
                  'RankingSnapshot', 'RankingEntry', 'RankingEntryResult',
                  'User', 'Role', 'Permission', 'RolePermission', 'UserRole',
                  'UserCredential', 'AdminSession', 'AdminRecoveryCode',
                  'RateLimitBucket', 'IdempotencyRecord', 'AuditLog'
                ) THEN true
              WHEN runtime_privilege.name = 'INSERT'
                AND runtime_table.relname IN (
                  'ImportBatch', 'ImportRow', 'MediaFile', 'Document',
                  'ExternalIdentifier', 'Country', 'NationalFederation', 'Discipline',
                  'Club', 'ResultStatus', 'Athlete', 'Horse', 'Owner',
                  'AthleteClubMembership', 'AthleteHorseRelation', 'HorseOwnership',
                  'CompetitionEvent', 'CompetitionClass', 'CompetitionResult',
                  'ResultMetric', 'RankingDefinition', 'RankingRuleSet', 'RankingPeriod',
                  'RankingSnapshot', 'RankingEntry', 'RankingEntryResult',
                  'AdminSession', 'AdminRecoveryCode', 'RateLimitBucket',
                  'IdempotencyRecord', 'AuditLog'
                ) THEN true
              WHEN runtime_privilege.name = 'UPDATE'
                AND runtime_table.relname IN (
                  'ImportBatch', 'ImportRow', 'MediaFile', 'Document',
                  'ExternalIdentifier', 'Country', 'NationalFederation', 'Discipline',
                  'Club', 'ResultStatus', 'Athlete', 'Horse', 'Owner',
                  'AthleteClubMembership', 'AthleteHorseRelation', 'HorseOwnership',
                  'CompetitionEvent', 'CompetitionClass', 'CompetitionResult',
                  'ResultMetric', 'RankingDefinition', 'RankingRuleSet', 'RankingPeriod',
                  'RankingSnapshot', 'RankingEntry', 'RankingEntryResult',
                  'UserCredential', 'AdminSession', 'AdminRecoveryCode',
                  'RateLimitBucket', 'IdempotencyRecord'
                ) THEN true
              WHEN runtime_privilege.name = 'DELETE'
                AND runtime_table.relname IN (
                  'ResultMetric', 'AdminRecoveryCode', 'RateLimitBucket',
                  'IdempotencyRecord'
                ) THEN true
              ELSE false
            END AS allowed
          ) expected_privilege
          WHERE runtime_table_namespace.nspname = 'public'
            AND runtime_table.relkind IN ('r', 'p')
            AND expected_privilege.allowed IS DISTINCT FROM has_table_privilege(
              current_user,
              runtime_table.oid,
              runtime_privilege.name
            )
        ) AS "hasTablePrivilegeDrift",
        EXISTS (
          SELECT 1
          FROM pg_class runtime_relation
          JOIN pg_namespace runtime_relation_namespace
            ON runtime_relation_namespace.oid = runtime_relation.relnamespace
          CROSS JOIN (
            VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'),
              ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')
          ) runtime_privilege(name)
          WHERE runtime_relation.relkind IN ('r', 'p', 'v', 'm', 'f')
            AND (
              (
                runtime_relation_namespace.nspname = 'public'
                AND runtime_relation.relkind NOT IN ('r', 'p')
              )
              OR (
                runtime_relation_namespace.nspname <> 'public'
                AND runtime_relation_namespace.nspname NOT IN (
                  'pg_catalog',
                  'information_schema'
                )
                AND runtime_relation_namespace.nspname NOT LIKE 'pg_toast%'
                AND runtime_relation_namespace.nspname NOT LIKE 'pg_temp_%'
              )
            )
            AND (
              has_table_privilege(
                current_user,
                runtime_relation.oid,
                runtime_privilege.name
              )
              OR has_table_privilege(
                expected_role.oid,
                runtime_relation.oid,
                runtime_privilege.name
              )
            )
        ) AS "hasUnexpectedRelationPrivilege",
        EXISTS (
          SELECT 1
          FROM pg_class runtime_table
          JOIN pg_namespace runtime_table_namespace
            ON runtime_table_namespace.oid = runtime_table.relnamespace
          CROSS JOIN (
            VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'),
              ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')
          ) runtime_privilege(name)
          WHERE runtime_table_namespace.nspname NOT IN ('pg_catalog', 'information_schema')
            AND runtime_table_namespace.nspname NOT LIKE 'pg_toast%'
            AND runtime_table_namespace.nspname NOT LIKE 'pg_temp_%'
            AND runtime_table.relkind IN ('r', 'p', 'v', 'm', 'f')
            AND (
              has_table_privilege(
                current_user,
                runtime_table.oid,
                runtime_privilege.name || ' WITH GRANT OPTION'
              )
              OR has_table_privilege(
                expected_role.oid,
                runtime_table.oid,
                runtime_privilege.name || ' WITH GRANT OPTION'
              )
            )
        ) AS "hasTableGrantOption",
        EXISTS (
          SELECT 1
          FROM pg_class runtime_table
          JOIN pg_namespace runtime_table_namespace
            ON runtime_table_namespace.oid = runtime_table.relnamespace
          JOIN pg_attribute runtime_column
            ON runtime_column.attrelid = runtime_table.oid
            AND runtime_column.attnum > 0
            AND runtime_column.attisdropped = false
          CROSS JOIN (
            VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('REFERENCES')
          ) runtime_privilege(name)
          WHERE runtime_table_namespace.nspname NOT IN ('pg_catalog', 'information_schema')
            AND runtime_table_namespace.nspname NOT LIKE 'pg_toast%'
            AND runtime_table_namespace.nspname NOT LIKE 'pg_temp_%'
            AND runtime_table.relkind IN ('r', 'p', 'v', 'm', 'f')
            AND has_column_privilege(
              current_user,
              runtime_table.oid,
              runtime_column.attname,
              runtime_privilege.name
            )
            AND NOT has_table_privilege(
              current_user,
              runtime_table.oid,
              runtime_privilege.name
            )
        ) AS "hasColumnPrivilegeDrift",
        EXISTS (
          SELECT 1
          FROM pg_class runtime_table
          JOIN pg_namespace runtime_table_namespace
            ON runtime_table_namespace.oid = runtime_table.relnamespace
          JOIN pg_attribute runtime_column
            ON runtime_column.attrelid = runtime_table.oid
            AND runtime_column.attnum > 0
            AND runtime_column.attisdropped = false
          CROSS JOIN (
            VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('REFERENCES')
          ) runtime_privilege(name)
          WHERE runtime_table_namespace.nspname NOT IN ('pg_catalog', 'information_schema')
            AND runtime_table_namespace.nspname NOT LIKE 'pg_toast%'
            AND runtime_table_namespace.nspname NOT LIKE 'pg_temp_%'
            AND runtime_table.relkind IN ('r', 'p', 'v', 'm', 'f')
            AND (
              has_column_privilege(
                current_user,
                runtime_table.oid,
                runtime_column.attname,
                runtime_privilege.name || ' WITH GRANT OPTION'
              )
              OR has_column_privilege(
                expected_role.oid,
                runtime_table.oid,
                runtime_column.attname,
                runtime_privilege.name || ' WITH GRANT OPTION'
              )
            )
        ) AS "hasColumnGrantOption",
        EXISTS (
          SELECT 1
          FROM (
            SELECT 1
            FROM pg_class acl_relation
            JOIN pg_namespace acl_relation_namespace
              ON acl_relation_namespace.oid = acl_relation.relnamespace
            CROSS JOIN LATERAL aclexplode(acl_relation.relacl) acl_entry
            WHERE (
              acl_relation_namespace.nspname = 'public'
              AND acl_relation.relkind IN ('r', 'p', 'v', 'm', 'f', 'S')
              AND acl_entry.grantee <> acl_relation.relowner
              AND (
                expected_role.oid IS NULL
                OR acl_entry.grantee <> expected_role.oid
                OR acl_relation.relkind NOT IN ('r', 'p')
              )
            )
              OR (
                acl_entry.grantee = role.oid
                OR (
                  acl_entry.grantee = expected_role.oid
                  AND (
                    acl_relation_namespace.nspname <> 'public'
                    OR acl_relation.relkind NOT IN ('r', 'p')
                  )
                )
              )
              OR (
                acl_relation_namespace.nspname = 'pg_catalog'
                AND acl_entry.grantee = 0
                AND NOT EXISTS (
                  SELECT 1
                  FROM pg_init_privs initial_privileges
                  CROSS JOIN LATERAL aclexplode(initial_privileges.initprivs)
                    initial_acl
                  WHERE initial_privileges.classoid = 'pg_class'::regclass
                    AND initial_privileges.objoid = acl_relation.oid
                    AND initial_privileges.objsubid = 0
                    AND initial_acl.grantee = 0
                    AND initial_acl.privilege_type = acl_entry.privilege_type
                    AND initial_acl.is_grantable = acl_entry.is_grantable
                )
              )
            UNION ALL
            SELECT 1
            FROM pg_attribute acl_column
            JOIN pg_class acl_column_relation
              ON acl_column_relation.oid = acl_column.attrelid
            JOIN pg_namespace acl_column_namespace
              ON acl_column_namespace.oid = acl_column_relation.relnamespace
            CROSS JOIN LATERAL aclexplode(acl_column.attacl) acl_entry
            WHERE (
              acl_column_namespace.nspname = 'public'
              AND acl_column_relation.relkind IN ('r', 'p', 'v', 'm', 'f')
              AND acl_entry.grantee <> acl_column_relation.relowner
            )
              OR acl_entry.grantee IN (role.oid, expected_role.oid)
            UNION ALL
            SELECT 1
            FROM pg_proc acl_function
            JOIN pg_namespace acl_function_namespace
              ON acl_function_namespace.oid = acl_function.pronamespace
            CROSS JOIN LATERAL aclexplode(acl_function.proacl) acl_entry
            WHERE acl_entry.grantee IN (role.oid, expected_role.oid)
              OR (
                acl_function_namespace.nspname = 'pg_catalog'
                AND acl_entry.grantee = 0
                AND NOT EXISTS (
                  SELECT 1
                  FROM pg_init_privs initial_privileges
                  CROSS JOIN LATERAL aclexplode(initial_privileges.initprivs)
                    initial_acl
                  WHERE initial_privileges.classoid = 'pg_proc'::regclass
                    AND initial_privileges.objoid = acl_function.oid
                    AND initial_privileges.objsubid = 0
                    AND initial_acl.grantee = 0
                    AND initial_acl.privilege_type = acl_entry.privilege_type
                    AND initial_acl.is_grantable = acl_entry.is_grantable
                )
              )
            UNION ALL
            SELECT 1
            FROM pg_type acl_type
            CROSS JOIN LATERAL aclexplode(acl_type.typacl) acl_entry
            WHERE acl_entry.grantee IN (role.oid, expected_role.oid)
              OR acl_entry.grantee = 0
            UNION ALL
            SELECT 1
            FROM pg_namespace acl_namespace
            CROSS JOIN LATERAL aclexplode(acl_namespace.nspacl) acl_entry
            WHERE acl_entry.grantee = role.oid
              OR (
                acl_entry.grantee = expected_role.oid
                AND NOT (
                  acl_namespace.nspname = 'public'
                  AND acl_entry.privilege_type = 'USAGE'
                  AND acl_entry.is_grantable = false
                )
              )
              OR (
                acl_entry.grantee = 0
                AND acl_namespace.nspname NOT IN ('pg_catalog', 'information_schema')
              )
            UNION ALL
            SELECT 1
            FROM pg_database acl_database
            CROSS JOIN LATERAL aclexplode(acl_database.datacl) acl_entry
            WHERE acl_entry.grantee = role.oid
              OR (
                acl_entry.grantee = expected_role.oid
                AND NOT (
                  acl_database.datname = current_database()
                  AND acl_entry.privilege_type = 'CONNECT'
                  AND acl_entry.is_grantable = false
                )
              )
              OR (
                acl_entry.grantee = 0
                AND acl_database.datname = current_database()
              )
            UNION ALL
            SELECT 1
            FROM pg_largeobject_metadata acl_large_object
            CROSS JOIN LATERAL aclexplode(acl_large_object.lomacl) acl_entry
            WHERE acl_entry.grantee IN (role.oid, expected_role.oid)
              OR acl_entry.grantee = 0
            UNION ALL
            SELECT 1
            FROM pg_foreign_data_wrapper acl_wrapper
            CROSS JOIN LATERAL aclexplode(acl_wrapper.fdwacl) acl_entry
            WHERE acl_entry.grantee IN (role.oid, expected_role.oid)
              OR acl_entry.grantee = 0
            UNION ALL
            SELECT 1
            FROM pg_foreign_server acl_server
            CROSS JOIN LATERAL aclexplode(acl_server.srvacl) acl_entry
            WHERE acl_entry.grantee IN (role.oid, expected_role.oid)
              OR acl_entry.grantee = 0
            UNION ALL
            SELECT 1
            FROM pg_tablespace acl_tablespace
            CROSS JOIN LATERAL aclexplode(acl_tablespace.spcacl) acl_entry
            WHERE acl_entry.grantee IN (role.oid, expected_role.oid)
              OR acl_entry.grantee = 0
            UNION ALL
            SELECT 1
            FROM pg_language acl_language
            CROSS JOIN LATERAL aclexplode(acl_language.lanacl) acl_entry
            WHERE acl_entry.grantee IN (role.oid, expected_role.oid)
              OR acl_entry.grantee = 0
            UNION ALL
            SELECT 1
            FROM pg_parameter_acl acl_parameter
            CROSS JOIN LATERAL aclexplode(acl_parameter.paracl) acl_entry
            WHERE acl_entry.grantee IN (role.oid, expected_role.oid)
              OR acl_entry.grantee = 0
          ) unexpected_acl
        ) AS "hasUnexpectedExplicitAcl",
        EXISTS (
          SELECT 1
          FROM pg_class runtime_sequence
          JOIN pg_namespace runtime_sequence_namespace
            ON runtime_sequence_namespace.oid = runtime_sequence.relnamespace
          WHERE runtime_sequence_namespace.nspname NOT IN ('pg_catalog', 'information_schema')
            AND runtime_sequence_namespace.nspname NOT LIKE 'pg_toast%'
            AND runtime_sequence_namespace.nspname NOT LIKE 'pg_temp_%'
            AND runtime_sequence.relkind = 'S'
            AND (
              has_sequence_privilege(current_user, runtime_sequence.oid, 'USAGE')
              OR has_sequence_privilege(current_user, runtime_sequence.oid, 'SELECT')
              OR has_sequence_privilege(current_user, runtime_sequence.oid, 'UPDATE')
            )
        ) AS "hasSequencePrivilege",
        EXISTS (
          SELECT 1
          FROM pg_proc runtime_function
          JOIN pg_namespace runtime_function_namespace
            ON runtime_function_namespace.oid = runtime_function.pronamespace
          WHERE runtime_function_namespace.nspname NOT IN ('pg_catalog', 'information_schema')
            AND runtime_function_namespace.nspname NOT LIKE 'pg_toast%'
            AND runtime_function_namespace.nspname NOT LIKE 'pg_temp_%'
            AND has_function_privilege(current_user, runtime_function.oid, 'EXECUTE')
            AND NOT EXISTS (
              SELECT 1
              FROM pg_depend extension_dependency
              JOIN pg_extension trusted_extension
                ON trusted_extension.oid = extension_dependency.refobjid
              WHERE extension_dependency.classid = 'pg_proc'::regclass
                AND extension_dependency.objid = runtime_function.oid
                AND extension_dependency.deptype = 'e'
                AND trusted_extension.extname = 'pg_trgm'
            )
        ) AS "hasFunctionPrivilege",
        NOT has_schema_privilege(current_user, 'public', 'USAGE') AS "missingSchemaUsage",
        (
          has_table_privilege(current_user, 'public._prisma_migrations', 'SELECT')
          OR has_table_privilege(current_user, 'public._prisma_migrations', 'INSERT')
          OR has_table_privilege(current_user, 'public._prisma_migrations', 'UPDATE')
          OR has_table_privilege(current_user, 'public._prisma_migrations', 'DELETE')
          OR has_table_privilege(current_user, 'public._prisma_migrations', 'TRUNCATE')
          OR has_table_privilege(current_user, 'public._prisma_migrations', 'REFERENCES')
          OR has_table_privilege(current_user, 'public._prisma_migrations', 'TRIGGER')
        ) AS "hasMigrationHistoryAccess",
        has_table_privilege(current_user, '"AuditLog"', 'UPDATE') AS "canUpdateAudit",
        has_table_privilege(current_user, '"AuditLog"', 'DELETE') AS "canDeleteAudit",
        has_table_privilege(current_user, '"AuditLog"', 'TRUNCATE') AS "canTruncateAudit",
        has_table_privilege(current_user, '"AuditLog"', 'TRIGGER') AS "canTriggerAudit",
        (
          has_table_privilege(current_user, '"Permission"', 'INSERT')
          OR has_table_privilege(current_user, '"Permission"', 'UPDATE')
          OR has_table_privilege(current_user, '"Permission"', 'DELETE')
          OR has_table_privilege(current_user, '"Permission"', 'TRUNCATE')
          OR has_table_privilege(current_user, '"RolePermission"', 'INSERT')
          OR has_table_privilege(current_user, '"RolePermission"', 'UPDATE')
          OR has_table_privilege(current_user, '"RolePermission"', 'DELETE')
          OR has_table_privilege(current_user, '"RolePermission"', 'TRUNCATE')
        ) AS "canMutatePermissionConfig"
      FROM pg_roles role
      CROSS JOIN LATERAL (
        SELECT 'fem_runtime_' || substring(md5(current_database()), 1, 16) AS name
      ) expected
      LEFT JOIN pg_roles expected_role ON expected_role.rolname = expected.name
      WHERE role.rolname = current_user
    `);
    if (
      !security ||
      !security.isExpectedRoleMember ||
      !security.expectedRoleIsRestricted ||
      !security.currentRoleIsRestricted ||
      security.hasUnexpectedMembership ||
      security.expectedRoleHasUnexpectedMembership ||
      security.hasOtherDatabaseConnect ||
      security.hasDangerousRuntimeSetting ||
      security.canCreateDatabaseObjects ||
      security.canCreateTemporaryObjects ||
      security.hasDatabaseGrantOption ||
      security.canCreateInPublic ||
      security.hasSchemaGrantOption ||
      security.hasUnexpectedSchemaAccess ||
      security.ownsPublicObject ||
      security.currentRoleHasDefaultAcl ||
      security.expectedRoleOwnsObject ||
      security.expectedRoleHasDefaultAcl ||
      security.hasTablePrivilegeDrift ||
      security.hasUnexpectedRelationPrivilege ||
      security.hasTableGrantOption ||
      security.hasColumnPrivilegeDrift ||
      security.hasColumnGrantOption ||
      security.hasUnexpectedExplicitAcl ||
      security.hasSequencePrivilege ||
      security.hasFunctionPrivilege ||
      security.missingSchemaUsage ||
      security.hasMigrationHistoryAccess ||
      security.canUpdateAudit ||
      security.canDeleteAudit ||
      security.canTruncateAudit ||
      security.canTriggerAudit ||
      security.canMutatePermissionConfig
    ) {
      throw new Error(
        'Production DATABASE_URL must use the restricted database-scoped runtime role',
      );
    }
  }
}

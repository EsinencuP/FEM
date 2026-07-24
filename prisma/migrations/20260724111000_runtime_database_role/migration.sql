-- Create the final database-scoped capability directly. No intermediate
-- cluster-global role ever receives application or migration-history access.
DO $$
DECLARE
  runtime_role text := 'fem_runtime_' || substring(md5(current_database()), 1, 16);
  existing_role record;
BEGIN
  SELECT *
  INTO existing_role
  FROM pg_roles
  WHERE rolname = runtime_role;

  IF FOUND THEN
    IF existing_role.rolcanlogin
      OR existing_role.rolsuper
      OR existing_role.rolcreatedb
      OR existing_role.rolcreaterole
      OR existing_role.rolreplication
      OR existing_role.rolbypassrls
      OR EXISTS (
        SELECT 1
        FROM pg_auth_members membership
        WHERE membership.member = existing_role.oid
          OR membership.roleid = existing_role.oid
      )
      OR EXISTS (SELECT 1 FROM pg_database WHERE datdba = existing_role.oid)
      OR EXISTS (SELECT 1 FROM pg_namespace WHERE nspowner = existing_role.oid)
      OR EXISTS (SELECT 1 FROM pg_class WHERE relowner = existing_role.oid)
      OR EXISTS (SELECT 1 FROM pg_proc WHERE proowner = existing_role.oid)
      OR EXISTS (SELECT 1 FROM pg_type WHERE typowner = existing_role.oid)
      OR EXISTS (
        SELECT 1
        FROM pg_default_acl default_acl
        LEFT JOIN LATERAL aclexplode(default_acl.defaclacl) acl_entry ON true
        WHERE default_acl.defaclrole = existing_role.oid
          OR acl_entry.grantee = existing_role.oid
      )
    THEN
      RAISE EXCEPTION
        'Refusing unexpected pre-existing database runtime capability role';
    END IF;
  ELSE
    EXECUTE format(
      'CREATE ROLE %I NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS',
      runtime_role
    );
  END IF;

  EXECUTE format(
    'REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM %I',
    runtime_role
  );
  EXECUTE format(
    'REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM %I',
    runtime_role
  );
  EXECUTE format(
    'REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM %I',
    runtime_role
  );
  REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM PUBLIC;
  REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;
  REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
  REVOKE ALL PRIVILEGES ON SCHEMA public FROM PUBLIC;
  EXECUTE format('REVOKE ALL PRIVILEGES ON SCHEMA public FROM %I', runtime_role);
  EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', runtime_role);

  EXECUTE format(
    'GRANT SELECT, INSERT, UPDATE ON TABLE
      "ImportBatch", "ImportRow", "MediaFile", "Document",
      "ExternalIdentifier", "Country", "NationalFederation", "Discipline",
      "Club", "ResultStatus", "Athlete", "Horse", "Owner",
      "AthleteClubMembership", "AthleteHorseRelation", "HorseOwnership",
      "CompetitionEvent", "CompetitionClass", "CompetitionResult",
      "ResultMetric", "RankingDefinition", "RankingRuleSet", "RankingPeriod",
      "RankingSnapshot", "RankingEntry", "RankingEntryResult"
    TO %I',
    runtime_role
  );
  EXECUTE format('GRANT DELETE ON TABLE "ResultMetric" TO %I', runtime_role);
  EXECUTE format(
    'GRANT SELECT ON TABLE "User", "Role", "Permission", "RolePermission", "UserRole" TO %I',
    runtime_role
  );
  EXECUTE format('GRANT SELECT, UPDATE ON TABLE "UserCredential" TO %I', runtime_role);
  EXECUTE format(
    'GRANT SELECT, INSERT, UPDATE ON TABLE "AdminSession" TO %I',
    runtime_role
  );
  EXECUTE format(
    'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "AdminRecoveryCode" TO %I',
    runtime_role
  );
  EXECUTE format(
    'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "RateLimitBucket", "IdempotencyRecord" TO %I',
    runtime_role
  );
  EXECUTE format('GRANT SELECT, INSERT ON TABLE "AuditLog" TO %I', runtime_role);
  EXECUTE format(
    'REVOKE ALL PRIVILEGES ON TABLE "_prisma_migrations" FROM %I',
    runtime_role
  );
END
$$;

DO $$
BEGIN
  EXECUTE format(
    'REVOKE CONNECT, CREATE, TEMPORARY ON DATABASE %I FROM PUBLIC',
    current_database()
  );
  EXECUTE format(
    'GRANT CONNECT ON DATABASE %I TO %I',
    current_database(),
    'fem_runtime_' || substring(md5(current_database()), 1, 16)
  );
END
$$;

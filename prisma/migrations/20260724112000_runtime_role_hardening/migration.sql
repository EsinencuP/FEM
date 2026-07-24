-- Verify the final capability established by the preceding migration. This
-- migration intentionally grants nothing.
DO $$
DECLARE
  runtime_role text := 'fem_runtime_' || substring(md5(current_database()), 1, 16);
  existing_role record;
BEGIN
  SELECT *
  INTO existing_role
  FROM pg_roles
  WHERE rolname = runtime_role;

  IF NOT FOUND
    OR existing_role.rolcanlogin
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
    RAISE EXCEPTION 'Database runtime capability verification failed';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "Permission"
    WHERE "id" = '00000000-0000-4000-8000-000000000105'::uuid
      AND "code" = 'VERSION_OVERRIDE'
      AND "name" = 'Override optimistic version'
      AND "isSystem" = true
      AND "archivedAt" IS NULL
  ) THEN
    RAISE EXCEPTION 'VERSION_OVERRIDE system permission metadata conflict';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Permission"
    WHERE "code" = 'VERSION_OVERRIDE'
      AND (
        "id" <> '00000000-0000-4000-8000-000000000105'::uuid
        OR "name" <> 'Override optimistic version'
        OR "isSystem" <> true
        OR "archivedAt" IS NOT NULL
      )
  ) THEN
    RAISE EXCEPTION 'VERSION_OVERRIDE system permission metadata conflict';
  END IF;
END
$$;

INSERT INTO "Permission" ("id", "code", "name", "description", "isSystem", "updatedAt")
VALUES (
  '00000000-0000-4000-8000-000000000105',
  'VERSION_OVERRIDE',
  'Override optimistic version',
  'Emergency confirmed override for a stale or unavailable resource version',
  true,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT gen_random_uuid(), role."id", permission."id"
FROM "Role" role
CROSS JOIN "Permission" permission
WHERE role."code" = 'ADMIN'
  AND permission."code" = 'VERSION_OVERRIDE'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- CreateTable
CREATE TABLE "Permission" (
    "id" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Permission_code_key" ON "Permission"("code");
CREATE INDEX "Permission_archivedAt_code_idx" ON "Permission"("archivedAt", "code");
CREATE UNIQUE INDEX "RolePermission_roleId_permissionId_key" ON "RolePermission"("roleId", "permissionId");
CREATE INDEX "RolePermission_permissionId_roleId_idx" ON "RolePermission"("permissionId", "roleId");

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey"
FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey"
FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed only the security vocabulary. This is configuration, not a human account.
INSERT INTO "Permission" ("id", "code", "name", "description", "isSystem", "updatedAt")
VALUES
('00000000-0000-4000-8000-000000000101', 'ADMIN_READ', 'Read administrative data', 'Read internal administrative resources', true, CURRENT_TIMESTAMP),
('00000000-0000-4000-8000-000000000102', 'ADMIN_WRITE', 'Change administrative data', 'Create, update, archive and restore administrative resources', true, CURRENT_TIMESTAMP),
('00000000-0000-4000-8000-000000000103', 'AUDIT_READ', 'Read audit log', 'Read immutable security and domain audit events', true, CURRENT_TIMESTAMP),
('00000000-0000-4000-8000-000000000104', 'SECURITY_SELF', 'Manage own security', 'Refresh and revoke own sessions, password and second factor', true, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT gen_random_uuid(), role."id", permission."id"
FROM "Role" role
CROSS JOIN "Permission" permission
WHERE role."code" = 'ADMIN'
  AND permission."code" IN ('ADMIN_READ', 'ADMIN_WRITE', 'AUDIT_READ', 'SECURITY_SELF')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

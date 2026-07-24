-- Preserve audit evidence when an actor is retained or removed.
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_actorId_fkey";

-- Add opaque-session rotation, recovery-assisted TOTP re-enrollment and
-- correlation fields. Existing pre-release sessions are safely backfilled as
-- TOTP-authenticated sessions.
ALTER TABLE "AdminSession"
ADD COLUMN "pendingTotpExpiresAt" TIMESTAMPTZ(3),
ADD COLUMN "pendingTotpSecretEncrypted" TEXT,
ADD COLUMN "previousTokenHash" CHAR(64),
ADD COLUMN "secondFactorMethod" VARCHAR(16) NOT NULL DEFAULT 'TOTP',
ADD COLUMN "tokenRotatedAt" TIMESTAMPTZ(3);

ALTER TABLE "AuditLog" ADD COLUMN "sessionId" UUID;
ALTER TABLE "UserCredential" ADD COLUMN "lastTotpStep" BIGINT;

CREATE UNIQUE INDEX "AdminSession_previousTokenHash_key"
ON "AdminSession"("previousTokenHash");

CREATE INDEX "AuditLog_sessionId_createdAt_idx"
ON "AuditLog"("sessionId", "createdAt" DESC);

ALTER TABLE "AuditLog"
ADD CONSTRAINT "AuditLog_actorId_fkey"
FOREIGN KEY ("actorId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AuditLog"
ADD CONSTRAINT "AuditLog_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "AdminSession"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "UserCredential"
ADD CONSTRAINT "UserCredential_lastTotpStep_check"
CHECK ("lastTotpStep" IS NULL OR "lastTotpStep" >= 0);

ALTER TABLE "AdminSession"
ADD CONSTRAINT "AdminSession_secondFactorMethod_check"
CHECK ("secondFactorMethod" IN ('TOTP', 'RECOVERY')),
ADD CONSTRAINT "AdminSession_pendingTotp_pair_check"
CHECK (
  ("pendingTotpSecretEncrypted" IS NULL AND "pendingTotpExpiresAt" IS NULL)
  OR
  ("pendingTotpSecretEncrypted" IS NOT NULL AND "pendingTotpExpiresAt" IS NOT NULL)
),
ADD CONSTRAINT "AdminSession_tokenRotatedAt_check"
CHECK ("tokenRotatedAt" IS NULL OR "tokenRotatedAt" >= "createdAt"),
ADD CONSTRAINT "AdminSession_previousTokenHash_check"
CHECK ("previousTokenHash" IS NULL OR "previousTokenHash" <> "tokenHash");

-- Audit records are append-only even if an application bug attempts a direct
-- UPDATE, DELETE or TRUNCATE through the runtime connection.
CREATE FUNCTION "prevent_audit_log_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog is append-only'
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER "AuditLog_prevent_update_delete"
BEFORE UPDATE OR DELETE ON "AuditLog"
FOR EACH ROW EXECUTE FUNCTION "prevent_audit_log_mutation"();

CREATE TRIGGER "AuditLog_prevent_truncate"
BEFORE TRUNCATE ON "AuditLog"
FOR EACH STATEMENT EXECUTE FUNCTION "prevent_audit_log_mutation"();

-- Security-state invariants that Prisma cannot express directly.
ALTER TABLE "UserCredential"
  ADD CONSTRAINT "UserCredential_failedLoginAttempts_nonnegative"
  CHECK ("failedLoginAttempts" >= 0);

ALTER TABLE "AdminSession"
  ADD CONSTRAINT "AdminSession_expiry_order"
  CHECK (
    "expiresAt" > "createdAt"
    AND "idleExpiresAt" > "createdAt"
    AND "idleExpiresAt" <= "expiresAt"
  ),
  ADD CONSTRAINT "AdminSession_revocation_order"
  CHECK ("revokedAt" IS NULL OR "revokedAt" >= "createdAt");

ALTER TABLE "AdminRecoveryCode"
  ADD CONSTRAINT "AdminRecoveryCode_usage_order"
  CHECK ("usedAt" IS NULL OR "usedAt" >= "createdAt");

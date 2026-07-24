ALTER TABLE "AdminSession"
ADD COLUMN "previousTokenExpiresAt" TIMESTAMPTZ(3);

ALTER TABLE "AdminSession"
ADD CONSTRAINT "AdminSession_previousToken_pair_check"
CHECK (
  ("previousTokenHash" IS NULL AND "previousTokenExpiresAt" IS NULL)
  OR
  ("previousTokenHash" IS NOT NULL AND "previousTokenExpiresAt" IS NOT NULL)
);

CREATE TABLE "IdempotencyRecord" (
  "id" CHAR(64) NOT NULL,
  "actorId" UUID NOT NULL,
  "sessionId" UUID NOT NULL,
  "key" VARCHAR(128) NOT NULL,
  "method" VARCHAR(10) NOT NULL,
  "path" VARCHAR(500) NOT NULL,
  "requestHash" CHAR(64) NOT NULL,
  "responseStatus" INTEGER NOT NULL,
  "responseBody" JSONB NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "IdempotencyRecord_method_check" CHECK ("method" = 'POST'),
  CONSTRAINT "IdempotencyRecord_status_check" CHECK ("responseStatus" BETWEEN 200 AND 299),
  CONSTRAINT "IdempotencyRecord_expiry_check" CHECK ("expiresAt" > "createdAt")
);

CREATE INDEX "IdempotencyRecord_actorId_createdAt_idx"
ON "IdempotencyRecord"("actorId", "createdAt" DESC);

CREATE INDEX "IdempotencyRecord_expiresAt_idx"
ON "IdempotencyRecord"("expiresAt");

ALTER TABLE "IdempotencyRecord"
ADD CONSTRAINT "IdempotencyRecord_actorId_fkey"
FOREIGN KEY ("actorId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "IdempotencyRecord"
ADD CONSTRAINT "IdempotencyRecord_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "AdminSession"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

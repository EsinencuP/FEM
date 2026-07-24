CREATE TABLE "RateLimitBucket" (
  "key" VARCHAR(200) NOT NULL,
  "throttlerName" VARCHAR(50) NOT NULL,
  "windowStartedAt" TIMESTAMPTZ(3) NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "totalHits" INTEGER NOT NULL,
  "blockedUntil" TIMESTAMPTZ(3),
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key"),
  CONSTRAINT "RateLimitBucket_totalHits_check" CHECK ("totalHits" >= 0),
  CONSTRAINT "RateLimitBucket_window_check" CHECK ("expiresAt" > "windowStartedAt"),
  CONSTRAINT "RateLimitBucket_blockedUntil_check"
    CHECK ("blockedUntil" IS NULL OR "blockedUntil" >= "windowStartedAt")
);

CREATE INDEX "RateLimitBucket_expiresAt_idx" ON "RateLimitBucket"("expiresAt");
CREATE INDEX "RateLimitBucket_blockedUntil_idx" ON "RateLimitBucket"("blockedUntil");

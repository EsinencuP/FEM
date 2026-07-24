ALTER TABLE "Country"
ADD COLUMN "publicationStatus" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN "publishedAt" TIMESTAMPTZ(3);

ALTER TABLE "Discipline"
ADD COLUMN "publicationStatus" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN "publishedAt" TIMESTAMPTZ(3);

ALTER TABLE "Club"
ADD COLUMN "publicationStatus" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN "publishedAt" TIMESTAMPTZ(3);

ALTER TABLE "Athlete"
ADD COLUMN "publicationStatus" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN "publishedAt" TIMESTAMPTZ(3);

ALTER TABLE "Horse"
ADD COLUMN "publicationStatus" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN "publishedAt" TIMESTAMPTZ(3);

ALTER TABLE "Country"
ADD CONSTRAINT "Country_published_timestamp_check"
CHECK ("publicationStatus" <> 'PUBLISHED' OR "publishedAt" IS NOT NULL),
ADD CONSTRAINT "Country_demo_publication_check"
CHECK (NOT "isDemo" OR ("publicationStatus" = 'DRAFT' AND "publishedAt" IS NULL));

ALTER TABLE "Discipline"
ADD CONSTRAINT "Discipline_published_timestamp_check"
CHECK ("publicationStatus" <> 'PUBLISHED' OR "publishedAt" IS NOT NULL),
ADD CONSTRAINT "Discipline_demo_publication_check"
CHECK (NOT "isDemo" OR ("publicationStatus" = 'DRAFT' AND "publishedAt" IS NULL));

ALTER TABLE "Club"
ADD CONSTRAINT "Club_published_timestamp_check"
CHECK ("publicationStatus" <> 'PUBLISHED' OR "publishedAt" IS NOT NULL),
ADD CONSTRAINT "Club_demo_publication_check"
CHECK (NOT "isDemo" OR ("publicationStatus" = 'DRAFT' AND "publishedAt" IS NULL));

ALTER TABLE "Athlete"
ADD CONSTRAINT "Athlete_published_timestamp_check"
CHECK ("publicationStatus" <> 'PUBLISHED' OR "publishedAt" IS NOT NULL),
ADD CONSTRAINT "Athlete_demo_publication_check"
CHECK (NOT "isDemo" OR ("publicationStatus" = 'DRAFT' AND "publishedAt" IS NULL));

ALTER TABLE "Horse"
ADD CONSTRAINT "Horse_published_timestamp_check"
CHECK ("publicationStatus" <> 'PUBLISHED' OR "publishedAt" IS NOT NULL),
ADD CONSTRAINT "Horse_demo_publication_check"
CHECK (NOT "isDemo" OR ("publicationStatus" = 'DRAFT' AND "publishedAt" IS NULL));

CREATE INDEX "Country_publicationStatus_archivedAt_name_id_idx"
ON "Country"("publicationStatus", "archivedAt", "name", "id");

CREATE INDEX "Discipline_publicationStatus_archivedAt_name_id_idx"
ON "Discipline"("publicationStatus", "archivedAt", "name", "id");

CREATE INDEX "Club_publicationStatus_archivedAt_name_id_idx"
ON "Club"("publicationStatus", "archivedAt", "name", "id");

CREATE INDEX "Athlete_publicationStatus_archivedAt_displayName_id_idx"
ON "Athlete"("publicationStatus", "archivedAt", "displayName", "id");

CREATE INDEX "Horse_publicationStatus_archivedAt_displayName_id_idx"
ON "Horse"("publicationStatus", "archivedAt", "displayName", "id");

-- Reject a dirty baseline instead of silently carrying mixed demo/official
-- result evidence into publication.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "ResultMetric" AS metric
    JOIN "CompetitionResult" AS result
      ON result."id" = metric."competitionResultId"
    WHERE metric."isDemo" IS DISTINCT FROM result."isDemo"
  ) THEN
    RAISE EXCEPTION
      'ResultMetric demo boundary conflicts with its CompetitionResult';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION "enforce_result_metric_demo_boundary"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  parent_is_demo BOOLEAN;
BEGIN
  SELECT "isDemo"
    INTO parent_is_demo
  FROM "CompetitionResult"
  WHERE "id" = NEW."competitionResultId";

  IF FOUND AND NEW."isDemo" IS DISTINCT FROM parent_is_demo THEN
    RAISE EXCEPTION
      'ResultMetric demo boundary must match CompetitionResult'
      USING
        ERRCODE = '23514',
        CONSTRAINT = 'ResultMetric_demo_boundary_check';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "ResultMetric_enforce_demo_boundary"
BEFORE INSERT OR UPDATE OF "competitionResultId", "isDemo"
ON "ResultMetric"
FOR EACH ROW
EXECUTE FUNCTION "enforce_result_metric_demo_boundary"();

-- Public list search uses case-insensitive contains predicates. B-tree indexes
-- cannot support ILIKE '%term%'; these measured query paths use pg_trgm GIN.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "Club_public_search_name_trgm_idx"
ON "Club" USING GIN ("name" gin_trgm_ops);

CREATE INDEX "Athlete_public_search_firstName_trgm_idx"
ON "Athlete" USING GIN ("firstName" gin_trgm_ops);

CREATE INDEX "Athlete_public_search_lastName_trgm_idx"
ON "Athlete" USING GIN ("lastName" gin_trgm_ops);

CREATE INDEX "Athlete_public_search_displayName_trgm_idx"
ON "Athlete" USING GIN ("displayName" gin_trgm_ops);

CREATE INDEX "Horse_public_search_passportName_trgm_idx"
ON "Horse" USING GIN ("passportName" gin_trgm_ops);

CREATE INDEX "Horse_public_search_displayName_trgm_idx"
ON "Horse" USING GIN ("displayName" gin_trgm_ops);

CREATE INDEX "Horse_public_search_breed_trgm_idx"
ON "Horse" USING GIN ("breed" gin_trgm_ops);

CREATE INDEX "Horse_public_search_color_trgm_idx"
ON "Horse" USING GIN ("color" gin_trgm_ops);

CREATE INDEX "CompetitionEvent_public_search_title_trgm_idx"
ON "CompetitionEvent" USING GIN ("title" gin_trgm_ops);

CREATE INDEX "CompetitionEvent_public_search_description_trgm_idx"
ON "CompetitionEvent" USING GIN ("description" gin_trgm_ops);

CREATE INDEX "CompetitionEvent_public_search_location_trgm_idx"
ON "CompetitionEvent" USING GIN ("location" gin_trgm_ops);

CREATE INDEX "CompetitionEvent_public_search_venue_trgm_idx"
ON "CompetitionEvent" USING GIN ("venue" gin_trgm_ops);

CREATE INDEX "CompetitionClass_public_search_title_trgm_idx"
ON "CompetitionClass" USING GIN ("title" gin_trgm_ops);

CREATE INDEX "CompetitionClass_public_search_category_trgm_idx"
ON "CompetitionClass" USING GIN ("category" gin_trgm_ops);

CREATE INDEX "CompetitionClass_public_search_level_trgm_idx"
ON "CompetitionClass" USING GIN ("level" gin_trgm_ops);

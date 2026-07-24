ALTER TABLE "ExternalIdentifier"
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
ADD CONSTRAINT "ExternalIdentifier_version_check" CHECK ("version" > 0);

ALTER TABLE "Country"
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
ADD CONSTRAINT "Country_version_check" CHECK ("version" > 0);

ALTER TABLE "Discipline"
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
ADD CONSTRAINT "Discipline_version_check" CHECK ("version" > 0);

ALTER TABLE "Club"
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
ADD CONSTRAINT "Club_version_check" CHECK ("version" > 0);

ALTER TABLE "Owner"
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
ADD CONSTRAINT "Owner_version_check" CHECK ("version" > 0);

ALTER TABLE "Athlete"
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
ADD CONSTRAINT "Athlete_version_check" CHECK ("version" > 0);

ALTER TABLE "Horse"
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
ADD CONSTRAINT "Horse_version_check" CHECK ("version" > 0);

ALTER TABLE "AthleteClubMembership"
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
ADD CONSTRAINT "AthleteClubMembership_version_check" CHECK ("version" > 0);

ALTER TABLE "AthleteHorseRelation"
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
ADD CONSTRAINT "AthleteHorseRelation_version_check" CHECK ("version" > 0);

ALTER TABLE "HorseOwnership"
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
ADD CONSTRAINT "HorseOwnership_version_check" CHECK ("version" > 0);

ALTER TABLE "CompetitionEvent"
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
ADD CONSTRAINT "CompetitionEvent_version_check" CHECK ("version" > 0);

ALTER TABLE "CompetitionClass"
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
ADD CONSTRAINT "CompetitionClass_version_check" CHECK ("version" > 0);

ALTER TABLE "CompetitionResult"
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
ADD CONSTRAINT "CompetitionResult_version_check" CHECK ("version" > 0);

ALTER TABLE "ResultMetric"
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
ADD CONSTRAINT "ResultMetric_version_check" CHECK ("version" > 0);

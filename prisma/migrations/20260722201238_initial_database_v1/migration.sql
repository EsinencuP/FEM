-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PublicationStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'VERIFIED', 'CONFLICT', 'REJECTED');

-- CreateEnum
CREATE TYPE "ImportBatchStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "ImportRowStatus" AS ENUM ('PENDING', 'VALIDATED', 'IMPORTED', 'SKIPPED', 'CONFLICT', 'FAILED');

-- CreateEnum
CREATE TYPE "RankingSubjectType" AS ENUM ('ATHLETE', 'HORSE', 'ATHLETE_HORSE_PAIR');

-- CreateEnum
CREATE TYPE "RankingCalculationStatus" AS ENUM ('DRAFT', 'PREPARING', 'FROZEN', 'FAILED', 'SUPERSEDED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "assignedById" UUID,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "oldData" JSONB,
    "newData" JSONB,
    "reason" TEXT,
    "requestId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" UUID NOT NULL,
    "entityType" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "status" "ImportBatchStatus" NOT NULL DEFAULT 'PENDING',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "successRows" INTEGER NOT NULL DEFAULT 0,
    "failedRows" INTEGER NOT NULL DEFAULT 0,
    "createdById" UUID,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(3),

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportRow" (
    "id" UUID NOT NULL,
    "importBatchId" UUID NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "rawData" JSONB NOT NULL,
    "normalizedData" JSONB,
    "status" "ImportRowStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "linkedEntityType" TEXT,
    "linkedEntityId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaFile" (
    "id" UUID NOT NULL,
    "storageKey" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "checksum" TEXT,
    "altText" TEXT,
    "credit" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'DRAFT',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "MediaFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "documentType" TEXT,
    "mediaFileId" UUID,
    "sourceUrl" TEXT,
    "issuedAt" DATE,
    "publicationStatus" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalIdentifier" (
    "id" UUID NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "identifierType" TEXT NOT NULL,
    "namespace" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "normalizedValue" TEXT NOT NULL,
    "normalizationVersion" TEXT NOT NULL,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "validFrom" DATE,
    "validTo" DATE,
    "sourceDocumentId" UUID,
    "sourceReference" TEXT,
    "verifiedById" UUID,
    "verifiedAt" TIMESTAMPTZ(3),
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ExternalIdentifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Country" (
    "id" UUID NOT NULL,
    "isoAlpha2" CHAR(2) NOT NULL,
    "isoAlpha3" CHAR(3) NOT NULL,
    "name" TEXT NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Country_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NationalFederation" (
    "id" UUID NOT NULL,
    "countryId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "websiteUrl" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'DRAFT',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "NationalFederation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Discipline" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'DRAFT',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Discipline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Club" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "countryId" UUID,
    "nationalFederationId" UUID,
    "status" "RecordStatus" NOT NULL DEFAULT 'DRAFT',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Club_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResultStatus" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isRankEligible" BOOLEAN,
    "status" "RecordStatus" NOT NULL DEFAULT 'DRAFT',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ResultStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Athlete" (
    "id" UUID NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "dateOfBirth" DATE,
    "gender" TEXT,
    "countryId" UUID,
    "nationalFederationId" UUID,
    "photoId" UUID,
    "status" "RecordStatus" NOT NULL DEFAULT 'DRAFT',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Athlete_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Horse" (
    "id" UUID NOT NULL,
    "passportName" TEXT,
    "displayName" TEXT NOT NULL,
    "dateOfBirth" DATE,
    "birthYear" INTEGER,
    "sex" TEXT,
    "breed" TEXT,
    "color" TEXT,
    "countryOfBirthId" UUID,
    "studbook" TEXT,
    "imageId" UUID,
    "status" "RecordStatus" NOT NULL DEFAULT 'DRAFT',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Horse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Owner" (
    "id" UUID NOT NULL,
    "displayName" TEXT NOT NULL,
    "ownerType" TEXT,
    "countryId" UUID,
    "status" "RecordStatus" NOT NULL DEFAULT 'DRAFT',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Owner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AthleteClubMembership" (
    "id" UUID NOT NULL,
    "athleteId" UUID NOT NULL,
    "clubId" UUID NOT NULL,
    "membershipType" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "sourceDocumentId" UUID,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AthleteClubMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AthleteHorseRelation" (
    "id" UUID NOT NULL,
    "athleteId" UUID NOT NULL,
    "horseId" UUID NOT NULL,
    "relationType" TEXT,
    "disciplineId" UUID,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "sourceDocumentId" UUID,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AthleteHorseRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HorseOwnership" (
    "id" UUID NOT NULL,
    "horseId" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "ownershipShare" DECIMAL(5,2),
    "sourceDocumentId" UUID,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "HorseOwnership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitionEvent" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "location" TEXT,
    "venue" TEXT,
    "countryId" UUID,
    "organizerName" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'DRAFT',
    "publicationStatus" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "coverMediaId" UUID,
    "publishedAt" TIMESTAMPTZ(3),
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CompetitionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitionClass" (
    "id" UUID NOT NULL,
    "competitionEventId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "disciplineId" UUID NOT NULL,
    "category" TEXT,
    "level" TEXT,
    "competitionDate" DATE,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "RecordStatus" NOT NULL DEFAULT 'DRAFT',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CompetitionClass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitionResult" (
    "id" UUID NOT NULL,
    "competitionClassId" UUID NOT NULL,
    "athleteId" UUID NOT NULL,
    "horseId" UUID NOT NULL,
    "rank" INTEGER,
    "statusId" UUID,
    "resultDisplay" TEXT,
    "penalties" DECIMAL(18,6),
    "timeSeconds" DECIMAL(12,3),
    "points" DECIMAL(18,6),
    "bonus" DECIMAL(18,6),
    "sourceDocumentId" UUID,
    "sourceReference" TEXT,
    "publicationStatus" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMPTZ(3),
    "approvedAt" TIMESTAMPTZ(3),
    "approvedById" UUID,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CompetitionResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResultMetric" (
    "id" UUID NOT NULL,
    "competitionResultId" UUID NOT NULL,
    "metricCode" TEXT NOT NULL,
    "numericValue" DECIMAL(18,6),
    "textValue" TEXT,
    "unit" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ResultMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RankingDefinition" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "disciplineId" UUID,
    "subjectType" "RankingSubjectType" NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'DRAFT',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RankingDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RankingRuleSet" (
    "id" UUID NOT NULL,
    "rankingDefinitionId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "calculationMethod" TEXT,
    "configuration" JSONB,
    "configurationSchemaVersion" TEXT,
    "engineVersion" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'DRAFT',
    "effectiveFrom" DATE,
    "effectiveTo" DATE,
    "sourceDocumentId" UUID,
    "sourceReference" TEXT,
    "approvedAt" TIMESTAMPTZ(3),
    "approvedById" UUID,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RankingRuleSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RankingPeriod" (
    "id" UUID NOT NULL,
    "rankingDefinitionId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startDate" DATE,
    "endDate" DATE,
    "status" "RecordStatus" NOT NULL DEFAULT 'DRAFT',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RankingPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RankingSnapshot" (
    "id" UUID NOT NULL,
    "rankingPeriodId" UUID NOT NULL,
    "rankingRuleSetId" UUID,
    "revision" INTEGER NOT NULL,
    "snapshotAt" TIMESTAMPTZ(3) NOT NULL,
    "calculationMethod" TEXT,
    "calculationStatus" "RankingCalculationStatus" NOT NULL DEFAULT 'DRAFT',
    "publicationStatus" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "calculatedAt" TIMESTAMPTZ(3),
    "publishedAt" TIMESTAMPTZ(3),
    "createdById" UUID,
    "supersedesSnapshotId" UUID,
    "comparisonSnapshotId" UUID,
    "notes" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RankingSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RankingEntry" (
    "id" UUID NOT NULL,
    "rankingSnapshotId" UUID NOT NULL,
    "subjectType" "RankingSubjectType" NOT NULL,
    "athleteId" UUID,
    "horseId" UUID,
    "rank" INTEGER,
    "previousRank" INTEGER,
    "points" DECIMAL(20,6),
    "countedResultCount" INTEGER NOT NULL DEFAULT 0,
    "droppedResultCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RankingEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RankingEntryResult" (
    "id" UUID NOT NULL,
    "rankingEntryId" UUID NOT NULL,
    "competitionResultId" UUID NOT NULL,
    "isCounted" BOOLEAN NOT NULL,
    "pointsContribution" DECIMAL(20,6),
    "decisionReason" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RankingEntryResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_status_archivedAt_idx" ON "User"("status", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");

-- CreateIndex
CREATE INDEX "UserRole_userId_startDate_endDate_idx" ON "UserRole"("userId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "UserRole_roleId_endDate_idx" ON "UserRole"("roleId", "endDate");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AuditLog_requestId_idx" ON "AuditLog"("requestId");

-- CreateIndex
CREATE INDEX "ImportBatch_status_createdAt_idx" ON "ImportBatch"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ImportBatch_checksum_sourceType_entityType_createdAt_idx" ON "ImportBatch"("checksum", "sourceType", "entityType", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ImportRow_importBatchId_status_rowNumber_idx" ON "ImportRow"("importBatchId", "status", "rowNumber");

-- CreateIndex
CREATE INDEX "ImportRow_linkedEntityType_linkedEntityId_idx" ON "ImportRow"("linkedEntityType", "linkedEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "ImportRow_importBatchId_rowNumber_key" ON "ImportRow"("importBatchId", "rowNumber");

-- CreateIndex
CREATE UNIQUE INDEX "MediaFile_storageKey_key" ON "MediaFile"("storageKey");

-- CreateIndex
CREATE INDEX "MediaFile_checksum_idx" ON "MediaFile"("checksum");

-- CreateIndex
CREATE INDEX "Document_publicationStatus_archivedAt_createdAt_idx" ON "Document"("publicationStatus", "archivedAt", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Document_mediaFileId_idx" ON "Document"("mediaFileId");

-- CreateIndex
CREATE INDEX "ExternalIdentifier_entityType_entityId_archivedAt_idx" ON "ExternalIdentifier"("entityType", "entityId", "archivedAt");

-- CreateIndex
CREATE INDEX "ExternalIdentifier_identifierType_normalizedValue_idx" ON "ExternalIdentifier"("identifierType", "normalizedValue");

-- CreateIndex
CREATE INDEX "ExternalIdentifier_verificationStatus_archivedAt_createdAt_idx" ON "ExternalIdentifier"("verificationStatus", "archivedAt", "createdAt");

-- CreateIndex
CREATE INDEX "ExternalIdentifier_sourceDocumentId_idx" ON "ExternalIdentifier"("sourceDocumentId");

-- CreateIndex
CREATE INDEX "ExternalIdentifier_verifiedById_idx" ON "ExternalIdentifier"("verifiedById");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalIdentifier_namespace_identifierType_normalizedValue_key" ON "ExternalIdentifier"("namespace", "identifierType", "normalizedValue");

-- CreateIndex
CREATE UNIQUE INDEX "Country_isoAlpha2_key" ON "Country"("isoAlpha2");

-- CreateIndex
CREATE UNIQUE INDEX "Country_isoAlpha3_key" ON "Country"("isoAlpha3");

-- CreateIndex
CREATE INDEX "NationalFederation_countryId_archivedAt_idx" ON "NationalFederation"("countryId", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Discipline_code_key" ON "Discipline"("code");

-- CreateIndex
CREATE INDEX "Club_countryId_status_archivedAt_idx" ON "Club"("countryId", "status", "archivedAt");

-- CreateIndex
CREATE INDEX "Club_nationalFederationId_archivedAt_idx" ON "Club"("nationalFederationId", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ResultStatus_code_key" ON "ResultStatus"("code");

-- CreateIndex
CREATE INDEX "Athlete_lastName_firstName_id_idx" ON "Athlete"("lastName", "firstName", "id");

-- CreateIndex
CREATE INDEX "Athlete_countryId_status_archivedAt_idx" ON "Athlete"("countryId", "status", "archivedAt");

-- CreateIndex
CREATE INDEX "Athlete_nationalFederationId_archivedAt_idx" ON "Athlete"("nationalFederationId", "archivedAt");

-- CreateIndex
CREATE INDEX "Horse_displayName_id_idx" ON "Horse"("displayName", "id");

-- CreateIndex
CREATE INDEX "Horse_passportName_id_idx" ON "Horse"("passportName", "id");

-- CreateIndex
CREATE INDEX "Horse_countryOfBirthId_status_archivedAt_idx" ON "Horse"("countryOfBirthId", "status", "archivedAt");

-- CreateIndex
CREATE INDEX "Owner_displayName_id_idx" ON "Owner"("displayName", "id");

-- CreateIndex
CREATE INDEX "Owner_countryId_archivedAt_idx" ON "Owner"("countryId", "archivedAt");

-- CreateIndex
CREATE INDEX "AthleteClubMembership_athleteId_startDate_endDate_idx" ON "AthleteClubMembership"("athleteId", "startDate" DESC, "endDate");

-- CreateIndex
CREATE INDEX "AthleteClubMembership_clubId_startDate_endDate_idx" ON "AthleteClubMembership"("clubId", "startDate" DESC, "endDate");

-- CreateIndex
CREATE INDEX "AthleteClubMembership_sourceDocumentId_idx" ON "AthleteClubMembership"("sourceDocumentId");

-- CreateIndex
CREATE INDEX "AthleteHorseRelation_athleteId_startDate_endDate_idx" ON "AthleteHorseRelation"("athleteId", "startDate" DESC, "endDate");

-- CreateIndex
CREATE INDEX "AthleteHorseRelation_horseId_startDate_endDate_idx" ON "AthleteHorseRelation"("horseId", "startDate" DESC, "endDate");

-- CreateIndex
CREATE INDEX "AthleteHorseRelation_disciplineId_endDate_idx" ON "AthleteHorseRelation"("disciplineId", "endDate");

-- CreateIndex
CREATE INDEX "AthleteHorseRelation_sourceDocumentId_idx" ON "AthleteHorseRelation"("sourceDocumentId");

-- CreateIndex
CREATE INDEX "HorseOwnership_horseId_startDate_endDate_idx" ON "HorseOwnership"("horseId", "startDate" DESC, "endDate");

-- CreateIndex
CREATE INDEX "HorseOwnership_ownerId_startDate_endDate_idx" ON "HorseOwnership"("ownerId", "startDate" DESC, "endDate");

-- CreateIndex
CREATE INDEX "HorseOwnership_sourceDocumentId_idx" ON "HorseOwnership"("sourceDocumentId");

-- CreateIndex
CREATE UNIQUE INDEX "HorseOwnership_horseId_ownerId_startDate_key" ON "HorseOwnership"("horseId", "ownerId", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitionEvent_slug_key" ON "CompetitionEvent"("slug");

-- CreateIndex
CREATE INDEX "CompetitionEvent_publicationStatus_startDate_id_idx" ON "CompetitionEvent"("publicationStatus", "startDate" DESC, "id");

-- CreateIndex
CREATE INDEX "CompetitionEvent_countryId_startDate_id_idx" ON "CompetitionEvent"("countryId", "startDate" DESC, "id");

-- CreateIndex
CREATE INDEX "CompetitionEvent_status_startDate_idx" ON "CompetitionEvent"("status", "startDate" DESC);

-- CreateIndex
CREATE INDEX "CompetitionClass_competitionEventId_sortOrder_id_idx" ON "CompetitionClass"("competitionEventId", "sortOrder", "id");

-- CreateIndex
CREATE INDEX "CompetitionClass_disciplineId_competitionDate_id_idx" ON "CompetitionClass"("disciplineId", "competitionDate", "id");

-- CreateIndex
CREATE INDEX "CompetitionClass_competitionEventId_status_idx" ON "CompetitionClass"("competitionEventId", "status");

-- CreateIndex
CREATE INDEX "CompetitionResult_competitionClassId_publicationStatus_rank_idx" ON "CompetitionResult"("competitionClassId", "publicationStatus", "rank", "id");

-- CreateIndex
CREATE INDEX "CompetitionResult_athleteId_publicationStatus_createdAt_id_idx" ON "CompetitionResult"("athleteId", "publicationStatus", "createdAt" DESC, "id");

-- CreateIndex
CREATE INDEX "CompetitionResult_horseId_publicationStatus_createdAt_id_idx" ON "CompetitionResult"("horseId", "publicationStatus", "createdAt" DESC, "id");

-- CreateIndex
CREATE INDEX "CompetitionResult_statusId_publicationStatus_idx" ON "CompetitionResult"("statusId", "publicationStatus");

-- CreateIndex
CREATE INDEX "CompetitionResult_sourceDocumentId_idx" ON "CompetitionResult"("sourceDocumentId");

-- CreateIndex
CREATE INDEX "CompetitionResult_approvedById_idx" ON "CompetitionResult"("approvedById");

-- CreateIndex
CREATE INDEX "ResultMetric_competitionResultId_sortOrder_id_idx" ON "ResultMetric"("competitionResultId", "sortOrder", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ResultMetric_competitionResultId_metricCode_sortOrder_key" ON "ResultMetric"("competitionResultId", "metricCode", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "RankingDefinition_code_key" ON "RankingDefinition"("code");

-- CreateIndex
CREATE INDEX "RankingDefinition_disciplineId_subjectType_status_archivedA_idx" ON "RankingDefinition"("disciplineId", "subjectType", "status", "archivedAt");

-- CreateIndex
CREATE INDEX "RankingRuleSet_rankingDefinitionId_status_archivedAt_idx" ON "RankingRuleSet"("rankingDefinitionId", "status", "archivedAt");

-- CreateIndex
CREATE INDEX "RankingRuleSet_sourceDocumentId_idx" ON "RankingRuleSet"("sourceDocumentId");

-- CreateIndex
CREATE INDEX "RankingRuleSet_approvedById_idx" ON "RankingRuleSet"("approvedById");

-- CreateIndex
CREATE UNIQUE INDEX "RankingRuleSet_rankingDefinitionId_version_key" ON "RankingRuleSet"("rankingDefinitionId", "version");

-- CreateIndex
CREATE INDEX "RankingPeriod_rankingDefinitionId_startDate_endDate_idx" ON "RankingPeriod"("rankingDefinitionId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "RankingPeriod_status_archivedAt_idx" ON "RankingPeriod"("status", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RankingPeriod_rankingDefinitionId_code_key" ON "RankingPeriod"("rankingDefinitionId", "code");

-- CreateIndex
CREATE INDEX "RankingSnapshot_rankingPeriodId_publicationStatus_snapshotA_idx" ON "RankingSnapshot"("rankingPeriodId", "publicationStatus", "snapshotAt" DESC, "revision" DESC);

-- CreateIndex
CREATE INDEX "RankingSnapshot_calculationStatus_createdAt_idx" ON "RankingSnapshot"("calculationStatus", "createdAt");

-- CreateIndex
CREATE INDEX "RankingSnapshot_rankingRuleSetId_idx" ON "RankingSnapshot"("rankingRuleSetId");

-- CreateIndex
CREATE INDEX "RankingSnapshot_createdById_idx" ON "RankingSnapshot"("createdById");

-- CreateIndex
CREATE INDEX "RankingSnapshot_supersedesSnapshotId_idx" ON "RankingSnapshot"("supersedesSnapshotId");

-- CreateIndex
CREATE INDEX "RankingSnapshot_comparisonSnapshotId_idx" ON "RankingSnapshot"("comparisonSnapshotId");

-- CreateIndex
CREATE UNIQUE INDEX "RankingSnapshot_rankingPeriodId_revision_key" ON "RankingSnapshot"("rankingPeriodId", "revision");

-- CreateIndex
CREATE INDEX "RankingEntry_rankingSnapshotId_rank_id_idx" ON "RankingEntry"("rankingSnapshotId", "rank", "id");

-- CreateIndex
CREATE INDEX "RankingEntry_athleteId_rankingSnapshotId_idx" ON "RankingEntry"("athleteId", "rankingSnapshotId");

-- CreateIndex
CREATE INDEX "RankingEntry_horseId_rankingSnapshotId_idx" ON "RankingEntry"("horseId", "rankingSnapshotId");

-- CreateIndex
CREATE INDEX "RankingEntryResult_rankingEntryId_isCounted_sortOrder_id_idx" ON "RankingEntryResult"("rankingEntryId", "isCounted", "sortOrder", "id");

-- CreateIndex
CREATE INDEX "RankingEntryResult_competitionResultId_idx" ON "RankingEntryResult"("competitionResultId");

-- CreateIndex
CREATE UNIQUE INDEX "RankingEntryResult_rankingEntryId_competitionResultId_key" ON "RankingEntryResult"("rankingEntryId", "competitionResultId");

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportRow" ADD CONSTRAINT "ImportRow_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_mediaFileId_fkey" FOREIGN KEY ("mediaFileId") REFERENCES "MediaFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalIdentifier" ADD CONSTRAINT "ExternalIdentifier_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalIdentifier" ADD CONSTRAINT "ExternalIdentifier_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NationalFederation" ADD CONSTRAINT "NationalFederation_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Club" ADD CONSTRAINT "Club_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Club" ADD CONSTRAINT "Club_nationalFederationId_fkey" FOREIGN KEY ("nationalFederationId") REFERENCES "NationalFederation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Athlete" ADD CONSTRAINT "Athlete_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Athlete" ADD CONSTRAINT "Athlete_nationalFederationId_fkey" FOREIGN KEY ("nationalFederationId") REFERENCES "NationalFederation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Athlete" ADD CONSTRAINT "Athlete_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "MediaFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Horse" ADD CONSTRAINT "Horse_countryOfBirthId_fkey" FOREIGN KEY ("countryOfBirthId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Horse" ADD CONSTRAINT "Horse_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "MediaFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Owner" ADD CONSTRAINT "Owner_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteClubMembership" ADD CONSTRAINT "AthleteClubMembership_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteClubMembership" ADD CONSTRAINT "AthleteClubMembership_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteClubMembership" ADD CONSTRAINT "AthleteClubMembership_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteHorseRelation" ADD CONSTRAINT "AthleteHorseRelation_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteHorseRelation" ADD CONSTRAINT "AthleteHorseRelation_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "Horse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteHorseRelation" ADD CONSTRAINT "AthleteHorseRelation_disciplineId_fkey" FOREIGN KEY ("disciplineId") REFERENCES "Discipline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteHorseRelation" ADD CONSTRAINT "AthleteHorseRelation_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HorseOwnership" ADD CONSTRAINT "HorseOwnership_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "Horse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HorseOwnership" ADD CONSTRAINT "HorseOwnership_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HorseOwnership" ADD CONSTRAINT "HorseOwnership_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionEvent" ADD CONSTRAINT "CompetitionEvent_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionEvent" ADD CONSTRAINT "CompetitionEvent_coverMediaId_fkey" FOREIGN KEY ("coverMediaId") REFERENCES "MediaFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionClass" ADD CONSTRAINT "CompetitionClass_competitionEventId_fkey" FOREIGN KEY ("competitionEventId") REFERENCES "CompetitionEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionClass" ADD CONSTRAINT "CompetitionClass_disciplineId_fkey" FOREIGN KEY ("disciplineId") REFERENCES "Discipline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionResult" ADD CONSTRAINT "CompetitionResult_competitionClassId_fkey" FOREIGN KEY ("competitionClassId") REFERENCES "CompetitionClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionResult" ADD CONSTRAINT "CompetitionResult_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionResult" ADD CONSTRAINT "CompetitionResult_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "Horse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionResult" ADD CONSTRAINT "CompetitionResult_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "ResultStatus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionResult" ADD CONSTRAINT "CompetitionResult_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionResult" ADD CONSTRAINT "CompetitionResult_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultMetric" ADD CONSTRAINT "ResultMetric_competitionResultId_fkey" FOREIGN KEY ("competitionResultId") REFERENCES "CompetitionResult"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankingDefinition" ADD CONSTRAINT "RankingDefinition_disciplineId_fkey" FOREIGN KEY ("disciplineId") REFERENCES "Discipline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankingRuleSet" ADD CONSTRAINT "RankingRuleSet_rankingDefinitionId_fkey" FOREIGN KEY ("rankingDefinitionId") REFERENCES "RankingDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankingRuleSet" ADD CONSTRAINT "RankingRuleSet_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankingRuleSet" ADD CONSTRAINT "RankingRuleSet_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankingPeriod" ADD CONSTRAINT "RankingPeriod_rankingDefinitionId_fkey" FOREIGN KEY ("rankingDefinitionId") REFERENCES "RankingDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankingSnapshot" ADD CONSTRAINT "RankingSnapshot_rankingPeriodId_fkey" FOREIGN KEY ("rankingPeriodId") REFERENCES "RankingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankingSnapshot" ADD CONSTRAINT "RankingSnapshot_rankingRuleSetId_fkey" FOREIGN KEY ("rankingRuleSetId") REFERENCES "RankingRuleSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankingSnapshot" ADD CONSTRAINT "RankingSnapshot_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankingSnapshot" ADD CONSTRAINT "RankingSnapshot_supersedesSnapshotId_fkey" FOREIGN KEY ("supersedesSnapshotId") REFERENCES "RankingSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankingSnapshot" ADD CONSTRAINT "RankingSnapshot_comparisonSnapshotId_fkey" FOREIGN KEY ("comparisonSnapshotId") REFERENCES "RankingSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankingEntry" ADD CONSTRAINT "RankingEntry_rankingSnapshotId_fkey" FOREIGN KEY ("rankingSnapshotId") REFERENCES "RankingSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankingEntry" ADD CONSTRAINT "RankingEntry_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankingEntry" ADD CONSTRAINT "RankingEntry_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "Horse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankingEntryResult" ADD CONSTRAINT "RankingEntryResult_rankingEntryId_fkey" FOREIGN KEY ("rankingEntryId") REFERENCES "RankingEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankingEntryResult" ADD CONSTRAINT "RankingEntryResult_competitionResultId_fkey" FOREIGN KEY ("competitionResultId") REFERENCES "CompetitionResult"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Database v1 manual constraints reviewed in docs/database/05-quality-review.md.
ALTER TABLE "User"
  ADD CONSTRAINT "User_email_normalized_check" CHECK ("email" = lower(btrim("email")) AND btrim("email") <> ''),
  ADD CONSTRAINT "User_displayName_nonempty_check" CHECK (btrim("displayName") <> '');

ALTER TABLE "Role"
  ADD CONSTRAINT "Role_code_nonempty_check" CHECK (btrim("code") <> ''),
  ADD CONSTRAINT "Role_name_nonempty_check" CHECK (btrim("name") <> '');

ALTER TABLE "UserRole"
  ADD CONSTRAINT "UserRole_date_order_check" CHECK ("endDate" IS NULL OR "endDate" >= "startDate");

ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_action_nonempty_check" CHECK (btrim("action") <> ''),
  ADD CONSTRAINT "AuditLog_entityType_nonempty_check" CHECK (btrim("entityType") <> '');

ALTER TABLE "ImportBatch"
  ADD CONSTRAINT "ImportBatch_required_text_check" CHECK (
    btrim("entityType") <> '' AND btrim("sourceType") <> ''
    AND btrim("filename") <> '' AND btrim("checksum") <> ''
  ),
  ADD CONSTRAINT "ImportBatch_counters_check" CHECK (
    "totalRows" >= 0 AND "successRows" >= 0 AND "failedRows" >= 0
    AND "successRows" + "failedRows" <= "totalRows"
  );

ALTER TABLE "ImportRow"
  ADD CONSTRAINT "ImportRow_number_check" CHECK ("rowNumber" > 0),
  ADD CONSTRAINT "ImportRow_link_pair_check" CHECK (
    ("linkedEntityType" IS NULL AND "linkedEntityId" IS NULL)
    OR ("linkedEntityType" IS NOT NULL AND btrim("linkedEntityType") <> '' AND "linkedEntityId" IS NOT NULL)
  );

ALTER TABLE "MediaFile"
  ADD CONSTRAINT "MediaFile_required_text_check" CHECK (
    btrim("storageKey") <> '' AND btrim("filename") <> '' AND btrim("mimeType") <> ''
  ),
  ADD CONSTRAINT "MediaFile_size_check" CHECK ("sizeBytes" >= 0);

ALTER TABLE "Document"
  ADD CONSTRAINT "Document_title_nonempty_check" CHECK (btrim("title") <> '');

ALTER TABLE "ExternalIdentifier"
  ADD CONSTRAINT "ExternalIdentifier_required_text_check" CHECK (
    btrim("entityType") <> '' AND btrim("identifierType") <> '' AND btrim("namespace") <> ''
    AND btrim("value") <> '' AND btrim("normalizedValue") <> '' AND btrim("normalizationVersion") <> ''
  ),
  ADD CONSTRAINT "ExternalIdentifier_validity_check" CHECK (
    "validTo" IS NULL OR "validFrom" IS NULL OR "validTo" >= "validFrom"
  );

ALTER TABLE "Country"
  ADD CONSTRAINT "Country_isoAlpha2_shape_check" CHECK ("isoAlpha2" ~ '^[A-Z]{2}$'),
  ADD CONSTRAINT "Country_isoAlpha3_shape_check" CHECK ("isoAlpha3" ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT "Country_name_nonempty_check" CHECK (btrim("name") <> '');

ALTER TABLE "NationalFederation"
  ADD CONSTRAINT "NationalFederation_name_nonempty_check" CHECK (btrim("name") <> '');

ALTER TABLE "Discipline"
  ADD CONSTRAINT "Discipline_required_text_check" CHECK (btrim("code") <> '' AND btrim("name") <> '');

ALTER TABLE "Club"
  ADD CONSTRAINT "Club_name_nonempty_check" CHECK (btrim("name") <> '');

ALTER TABLE "ResultStatus"
  ADD CONSTRAINT "ResultStatus_required_text_check" CHECK (btrim("code") <> '' AND btrim("label") <> ''),
  ADD CONSTRAINT "ResultStatus_sortOrder_check" CHECK ("sortOrder" >= 0);

ALTER TABLE "Athlete"
  ADD CONSTRAINT "Athlete_required_names_check" CHECK (
    btrim("firstName") <> '' AND btrim("lastName") <> '' AND btrim("displayName") <> ''
  );

ALTER TABLE "Horse"
  ADD CONSTRAINT "Horse_displayName_nonempty_check" CHECK (btrim("displayName") <> ''),
  ADD CONSTRAINT "Horse_birthYear_check" CHECK ("birthYear" IS NULL OR "birthYear" BETWEEN 1000 AND 9999),
  ADD CONSTRAINT "Horse_birth_date_year_check" CHECK (
    "dateOfBirth" IS NULL OR "birthYear" IS NULL OR extract(year from "dateOfBirth")::integer = "birthYear"
  );

ALTER TABLE "Owner"
  ADD CONSTRAINT "Owner_displayName_nonempty_check" CHECK (btrim("displayName") <> '');

ALTER TABLE "AthleteClubMembership"
  ADD CONSTRAINT "AthleteClubMembership_date_order_check" CHECK ("endDate" IS NULL OR "endDate" >= "startDate");

ALTER TABLE "AthleteHorseRelation"
  ADD CONSTRAINT "AthleteHorseRelation_date_order_check" CHECK ("endDate" IS NULL OR "endDate" >= "startDate");

ALTER TABLE "HorseOwnership"
  ADD CONSTRAINT "HorseOwnership_date_order_check" CHECK ("endDate" IS NULL OR "endDate" >= "startDate"),
  ADD CONSTRAINT "HorseOwnership_share_check" CHECK (
    "ownershipShare" IS NULL OR ("ownershipShare" > 0 AND "ownershipShare" <= 100)
  );

ALTER TABLE "CompetitionEvent"
  ADD CONSTRAINT "CompetitionEvent_required_text_check" CHECK (btrim("title") <> '' AND btrim("slug") <> ''),
  ADD CONSTRAINT "CompetitionEvent_date_order_check" CHECK ("endDate" >= "startDate"),
  ADD CONSTRAINT "CompetitionEvent_publication_check" CHECK (
    "publicationStatus" <> 'PUBLISHED' OR "publishedAt" IS NOT NULL
  );

ALTER TABLE "CompetitionClass"
  ADD CONSTRAINT "CompetitionClass_title_nonempty_check" CHECK (btrim("title") <> ''),
  ADD CONSTRAINT "CompetitionClass_sortOrder_check" CHECK ("sortOrder" >= 0);

ALTER TABLE "CompetitionResult"
  ADD CONSTRAINT "CompetitionResult_rank_check" CHECK ("rank" IS NULL OR "rank" > 0),
  ADD CONSTRAINT "CompetitionResult_time_check" CHECK ("timeSeconds" IS NULL OR "timeSeconds" >= 0),
  ADD CONSTRAINT "CompetitionResult_approval_pair_check" CHECK (
    ("approvedAt" IS NULL AND "approvedById" IS NULL)
    OR ("approvedAt" IS NOT NULL AND "approvedById" IS NOT NULL)
  ),
  ADD CONSTRAINT "CompetitionResult_publication_check" CHECK (
    "publicationStatus" <> 'PUBLISHED' OR "publishedAt" IS NOT NULL
  );

ALTER TABLE "ResultMetric"
  ADD CONSTRAINT "ResultMetric_code_nonempty_check" CHECK (btrim("metricCode") <> ''),
  ADD CONSTRAINT "ResultMetric_value_xor_check" CHECK (
    ("numericValue" IS NOT NULL AND "textValue" IS NULL)
    OR ("numericValue" IS NULL AND "textValue" IS NOT NULL)
  ),
  ADD CONSTRAINT "ResultMetric_sortOrder_check" CHECK ("sortOrder" >= 0);

ALTER TABLE "RankingDefinition"
  ADD CONSTRAINT "RankingDefinition_required_text_check" CHECK (btrim("code") <> '' AND btrim("name") <> '');

ALTER TABLE "RankingRuleSet"
  ADD CONSTRAINT "RankingRuleSet_version_check" CHECK ("version" > 0),
  ADD CONSTRAINT "RankingRuleSet_name_nonempty_check" CHECK (btrim("name") <> ''),
  ADD CONSTRAINT "RankingRuleSet_date_order_check" CHECK (
    "effectiveTo" IS NULL OR "effectiveFrom" IS NULL OR "effectiveTo" >= "effectiveFrom"
  ),
  ADD CONSTRAINT "RankingRuleSet_approval_pair_check" CHECK (
    ("approvedAt" IS NULL AND "approvedById" IS NULL)
    OR ("approvedAt" IS NOT NULL AND "approvedById" IS NOT NULL)
  ),
  ADD CONSTRAINT "RankingRuleSet_configuration_version_check" CHECK (
    "configuration" IS NULL
    OR ("configurationSchemaVersion" IS NOT NULL AND btrim("configurationSchemaVersion") <> '')
  );

ALTER TABLE "RankingPeriod"
  ADD CONSTRAINT "RankingPeriod_required_text_check" CHECK (btrim("code") <> '' AND btrim("label") <> ''),
  ADD CONSTRAINT "RankingPeriod_date_order_check" CHECK (
    "endDate" IS NULL OR "startDate" IS NULL OR "endDate" >= "startDate"
  );

ALTER TABLE "RankingSnapshot"
  ADD CONSTRAINT "RankingSnapshot_revision_check" CHECK ("revision" > 0),
  ADD CONSTRAINT "RankingSnapshot_self_reference_check" CHECK (
    ("supersedesSnapshotId" IS NULL OR "supersedesSnapshotId" <> "id")
    AND ("comparisonSnapshotId" IS NULL OR "comparisonSnapshotId" <> "id")
  ),
  ADD CONSTRAINT "RankingSnapshot_publication_check" CHECK (
    "publicationStatus" <> 'PUBLISHED' OR "publishedAt" IS NOT NULL
  ),
  ADD CONSTRAINT "RankingSnapshot_demo_draft_check" CHECK (
    NOT "isDemo" OR ("publicationStatus" = 'DRAFT' AND "publishedAt" IS NULL)
  );

ALTER TABLE "RankingEntry"
  ADD CONSTRAINT "RankingEntry_subject_shape_check" CHECK (
    ("subjectType" = 'ATHLETE' AND "athleteId" IS NOT NULL AND "horseId" IS NULL)
    OR ("subjectType" = 'HORSE' AND "athleteId" IS NULL AND "horseId" IS NOT NULL)
    OR ("subjectType" = 'ATHLETE_HORSE_PAIR' AND "athleteId" IS NOT NULL AND "horseId" IS NOT NULL)
  ),
  ADD CONSTRAINT "RankingEntry_rank_check" CHECK ("rank" IS NULL OR "rank" > 0),
  ADD CONSTRAINT "RankingEntry_previousRank_check" CHECK ("previousRank" IS NULL OR "previousRank" > 0),
  ADD CONSTRAINT "RankingEntry_counts_check" CHECK (
    "countedResultCount" >= 0 AND "droppedResultCount" >= 0
  );

ALTER TABLE "RankingEntryResult"
  ADD CONSTRAINT "RankingEntryResult_sortOrder_check" CHECK ("sortOrder" >= 0);

-- PostgreSQL-specific uniqueness that Prisma schema cannot express.
CREATE UNIQUE INDEX "UserRole_active_user_role_key"
ON "UserRole" ("userId", "roleId")
WHERE "endDate" IS NULL AND "archivedAt" IS NULL;

CREATE UNIQUE INDEX "AthleteClubMembership_exact_key"
ON "AthleteClubMembership" ("athleteId", "clubId", "startDate", "membershipType") NULLS NOT DISTINCT;

CREATE UNIQUE INDEX "AthleteHorseRelation_exact_key"
ON "AthleteHorseRelation" ("athleteId", "horseId", "relationType", "startDate", "disciplineId") NULLS NOT DISTINCT;

CREATE UNIQUE INDEX "RankingEntry_snapshot_athlete_key"
ON "RankingEntry" ("rankingSnapshotId", "athleteId")
WHERE "subjectType" = 'ATHLETE';

CREATE UNIQUE INDEX "RankingEntry_snapshot_horse_key"
ON "RankingEntry" ("rankingSnapshotId", "horseId")
WHERE "subjectType" = 'HORSE';

CREATE UNIQUE INDEX "RankingEntry_snapshot_pair_key"
ON "RankingEntry" ("rankingSnapshotId", "athleteId", "horseId")
WHERE "subjectType" = 'ATHLETE_HORSE_PAIR';

-- Fast current-history lookups without asserting that only one current relation may exist.
CREATE INDEX "AthleteClubMembership_current_athlete_idx"
ON "AthleteClubMembership" ("athleteId", "startDate" DESC)
WHERE "endDate" IS NULL AND "archivedAt" IS NULL;

CREATE INDEX "AthleteClubMembership_current_club_idx"
ON "AthleteClubMembership" ("clubId", "startDate" DESC)
WHERE "endDate" IS NULL AND "archivedAt" IS NULL;

CREATE INDEX "AthleteHorseRelation_current_athlete_idx"
ON "AthleteHorseRelation" ("athleteId", "startDate" DESC)
WHERE "endDate" IS NULL AND "archivedAt" IS NULL;

CREATE INDEX "AthleteHorseRelation_current_horse_idx"
ON "AthleteHorseRelation" ("horseId", "startDate" DESC)
WHERE "endDate" IS NULL AND "archivedAt" IS NULL;

CREATE INDEX "HorseOwnership_current_horse_idx"
ON "HorseOwnership" ("horseId", "startDate" DESC)
WHERE "endDate" IS NULL AND "archivedAt" IS NULL;

CREATE INDEX "HorseOwnership_current_owner_idx"
ON "HorseOwnership" ("ownerId", "startDate" DESC)
WHERE "endDate" IS NULL AND "archivedAt" IS NULL;

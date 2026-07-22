-- DropForeignKey
ALTER TABLE "CompetitionResult" DROP CONSTRAINT "CompetitionResult_approvedById_fkey";

-- DropForeignKey
ALTER TABLE "RankingRuleSet" DROP CONSTRAINT "RankingRuleSet_approvedById_fkey";

-- CreateIndex
CREATE INDEX "Athlete_displayName_id_idx" ON "Athlete"("displayName", "id");

-- CreateIndex
CREATE INDEX "Club_name_id_idx" ON "Club"("name", "id");

-- CreateIndex
CREATE INDEX "CompetitionEvent_endDate_id_idx" ON "CompetitionEvent"("endDate", "id");

-- CreateIndex
CREATE INDEX "Horse_birthYear_displayName_id_idx" ON "Horse"("birthYear", "displayName", "id");

-- AddForeignKey
ALTER TABLE "CompetitionResult" ADD CONSTRAINT "CompetitionResult_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankingRuleSet" ADD CONSTRAINT "RankingRuleSet_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

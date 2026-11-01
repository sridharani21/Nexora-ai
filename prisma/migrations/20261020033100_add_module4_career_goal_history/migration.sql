CREATE TABLE "Module4CareerGoal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "careerId" TEXT NOT NULL,
    "recommendationId" TEXT,
    "skillEvidence" JSONB NOT NULL,
    "skillGaps" JSONB NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "selectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    CONSTRAINT "Module4CareerGoal_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Module4CareerGoal_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Module4CareerGoal_careerId_fkey"
        FOREIGN KEY ("careerId") REFERENCES "Module4Career"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Module4CareerGoal_recommendationId_fkey"
        FOREIGN KEY ("recommendationId") REFERENCES "Module4CareerRecommendation"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "Module4CareerGoal_userId_isCurrent_selectedAt_idx"
    ON "Module4CareerGoal"("userId", "isCurrent", "selectedAt");
CREATE INDEX "Module4CareerGoal_careerId_selectedAt_idx"
    ON "Module4CareerGoal"("careerId", "selectedAt");
CREATE INDEX "Module4CareerGoal_recommendationId_idx"
    ON "Module4CareerGoal"("recommendationId");
CREATE UNIQUE INDEX "Module4CareerGoal_one_current_per_user_key"
    ON "Module4CareerGoal"("userId")
    WHERE "isCurrent" = true;

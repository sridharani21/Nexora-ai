CREATE TABLE "PlacementAssessmentAttempt" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "sectionScores" JSONB NOT NULL,
    "interestAnswers" JSONB NOT NULL,
    "careerField" TEXT NOT NULL,
    "suitabilityProfile" JSONB NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlacementAssessmentAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlacementAssessmentAttempt_journeyId_idx" ON "PlacementAssessmentAttempt"("journeyId");
CREATE INDEX "PlacementAssessmentAttempt_journeyId_completedAt_idx" ON "PlacementAssessmentAttempt"("journeyId", "completedAt");
ALTER TABLE "PlacementAssessmentAttempt" ADD CONSTRAINT "PlacementAssessmentAttempt_journeyId_fkey"
  FOREIGN KEY ("journeyId") REFERENCES "PlacementJourney"("id") ON DELETE CASCADE ON UPDATE CASCADE;

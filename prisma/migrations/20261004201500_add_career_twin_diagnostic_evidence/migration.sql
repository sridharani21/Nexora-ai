CREATE TABLE "CareerTwin" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "currentSkills" JSONB NOT NULL,
    "skillScores" JSONB NOT NULL,
    "interests" JSONB NOT NULL,
    "strengths" JSONB NOT NULL,
    "weaknesses" JSONB NOT NULL,
    "dsaLevel" TEXT NOT NULL DEFAULT 'foundation',
    "codingLevel" TEXT NOT NULL DEFAULT 'foundation',
    "careerField" TEXT,
    "recommendedRoles" JSONB NOT NULL,
    "alternativeRoles" JSONB NOT NULL,
    "evidence" JSONB NOT NULL,
    "placementReadiness" INTEGER NOT NULL DEFAULT 0,
    "lastAssessmentId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CareerTwin_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CareerTwin_journeyId_key" ON "CareerTwin"("journeyId");

ALTER TABLE "CareerTwin" ADD CONSTRAINT "CareerTwin_journeyId_fkey"
  FOREIGN KEY ("journeyId") REFERENCES "PlacementJourney"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlacementAssessmentAttempt"
  ADD COLUMN "assessmentType" TEXT NOT NULL DEFAULT 'diagnostic',
  ADD COLUMN "adaptiveDifficulty" TEXT NOT NULL DEFAULT 'foundation',
  ADD COLUMN "evidence" JSONB;

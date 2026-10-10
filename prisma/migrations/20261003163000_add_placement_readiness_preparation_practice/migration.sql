CREATE TABLE "PlacementReadinessReport" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "skillScores" JSONB NOT NULL,
    "strengths" JSONB NOT NULL,
    "weaknesses" JSONB NOT NULL,
    "skillGaps" JSONB NOT NULL,
    "targetRole" TEXT,
    "targetCompany" TEXT,
    "profileSnapshot" JSONB NOT NULL,
    "assessmentId" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlacementReadinessReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlacementPreparationPlan" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "adaptiveDifficulty" TEXT NOT NULL DEFAULT 'foundation',
    "recommendations" JSONB NOT NULL,
    "planData" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlacementPreparationPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlacementPreparationTask" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "goal" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlacementPreparationTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PracticeAttempt" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'practice',
    "companyPattern" TEXT,
    "timed" BOOLEAN NOT NULL DEFAULT false,
    "difficulty" TEXT NOT NULL DEFAULT 'adaptive',
    "questionCount" INTEGER NOT NULL,
    "correctCount" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "durationSeconds" INTEGER,
    "answers" JSONB NOT NULL,
    "mistakes" JSONB NOT NULL,
    "weakTopics" JSONB NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PracticeAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlacementReadinessReport_journeyId_key" ON "PlacementReadinessReport"("journeyId");
CREATE UNIQUE INDEX "PlacementPreparationPlan_journeyId_key" ON "PlacementPreparationPlan"("journeyId");
CREATE INDEX "PlacementPreparationTask_planId_day_idx" ON "PlacementPreparationTask"("planId", "day");
CREATE INDEX "PracticeAttempt_journeyId_completedAt_idx" ON "PracticeAttempt"("journeyId", "completedAt");
CREATE INDEX "PracticeAttempt_journeyId_topic_idx" ON "PracticeAttempt"("journeyId", "topic");

ALTER TABLE "PlacementReadinessReport" ADD CONSTRAINT "PlacementReadinessReport_journeyId_fkey"
  FOREIGN KEY ("journeyId") REFERENCES "PlacementJourney"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlacementPreparationPlan" ADD CONSTRAINT "PlacementPreparationPlan_journeyId_fkey"
  FOREIGN KEY ("journeyId") REFERENCES "PlacementJourney"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlacementPreparationTask" ADD CONSTRAINT "PlacementPreparationTask_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "PlacementPreparationPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PracticeAttempt" ADD CONSTRAINT "PracticeAttempt_journeyId_fkey"
  FOREIGN KEY ("journeyId") REFERENCES "PlacementJourney"("id") ON DELETE CASCADE ON UPDATE CASCADE;

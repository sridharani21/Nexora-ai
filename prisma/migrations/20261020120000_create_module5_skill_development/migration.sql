CREATE TABLE "CareerPreparationPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "careerId" TEXT NOT NULL,
    "goalId" TEXT,
    "version" INTEGER NOT NULL,
    "weeks" INTEGER NOT NULL,
    "dailyHours" DOUBLE PRECISION NOT NULL,
    "studyDays" INTEGER NOT NULL,
    "startDate" DATE NOT NULL,
    "skillLevel" TEXT NOT NULL,
    "learningPreference" TEXT NOT NULL,
    "skillAnalysis" JSONB NOT NULL,
    "weeklyGoals" JSONB NOT NULL,
    "sourceSnapshot" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareerPreparationPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CareerPreparationTask" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "scheduledDate" DATE NOT NULL,
    "skill" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "objectives" JSONB NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "activity" TEXT NOT NULL,
    "completionCriteria" TEXT NOT NULL,
    "resources" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareerPreparationTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CareerPreparationAttempt" (
    "id" TEXT NOT NULL,
    "submissionKey" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT,
    "kind" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "questionSnapshot" JSONB NOT NULL,
    "answers" JSONB NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "feedback" JSONB NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CareerPreparationAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CareerPreparationPlan_userId_version_key" ON "CareerPreparationPlan"("userId", "version");
CREATE INDEX "CareerPreparationPlan_userId_status_createdAt_idx" ON "CareerPreparationPlan"("userId", "status", "createdAt");
CREATE INDEX "CareerPreparationPlan_goalId_createdAt_idx" ON "CareerPreparationPlan"("goalId", "createdAt");
CREATE UNIQUE INDEX "CareerPreparationTask_planId_weekNumber_dayNumber_key" ON "CareerPreparationTask"("planId", "weekNumber", "dayNumber");
CREATE INDEX "CareerPreparationTask_userId_status_weekNumber_idx" ON "CareerPreparationTask"("userId", "status", "weekNumber");
CREATE INDEX "CareerPreparationTask_planId_weekNumber_dayNumber_idx" ON "CareerPreparationTask"("planId", "weekNumber", "dayNumber");
CREATE UNIQUE INDEX "CareerPreparationAttempt_submissionKey_key" ON "CareerPreparationAttempt"("submissionKey");
CREATE INDEX "CareerPreparationAttempt_userId_planId_submittedAt_idx" ON "CareerPreparationAttempt"("userId", "planId", "submittedAt");
CREATE INDEX "CareerPreparationAttempt_planId_kind_weekNumber_idx" ON "CareerPreparationAttempt"("planId", "kind", "weekNumber");
CREATE INDEX "CareerPreparationAttempt_taskId_kind_attemptNumber_idx" ON "CareerPreparationAttempt"("taskId", "kind", "attemptNumber");

ALTER TABLE "CareerPreparationPlan" ADD CONSTRAINT "CareerPreparationPlan_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CareerPreparationPlan" ADD CONSTRAINT "CareerPreparationPlan_careerId_fkey"
FOREIGN KEY ("careerId") REFERENCES "Module4Career"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CareerPreparationPlan" ADD CONSTRAINT "CareerPreparationPlan_goalId_fkey"
FOREIGN KEY ("goalId") REFERENCES "Module4CareerGoal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CareerPreparationTask" ADD CONSTRAINT "CareerPreparationTask_planId_fkey"
FOREIGN KEY ("planId") REFERENCES "CareerPreparationPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CareerPreparationTask" ADD CONSTRAINT "CareerPreparationTask_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CareerPreparationAttempt" ADD CONSTRAINT "CareerPreparationAttempt_planId_fkey"
FOREIGN KEY ("planId") REFERENCES "CareerPreparationPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CareerPreparationAttempt" ADD CONSTRAINT "CareerPreparationAttempt_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CareerPreparationAttempt" ADD CONSTRAINT "CareerPreparationAttempt_taskId_fkey"
FOREIGN KEY ("taskId") REFERENCES "CareerPreparationTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

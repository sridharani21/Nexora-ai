CREATE TABLE "MockInterviewSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "careerId" TEXT NOT NULL,
    "goalId" TEXT,
    "planId" TEXT,
    "careerTitle" TEXT NOT NULL,
    "interviewType" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'English',
    "questions" JSONB NOT NULL,
    "profileSnapshot" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "report" JSONB,
    "overallScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "MockInterviewSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MockInterviewAnswer" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answerText" TEXT NOT NULL,
    "evaluation" JSONB NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MockInterviewAnswer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MockInterviewSession_userId_createdAt_idx" ON "MockInterviewSession"("userId", "createdAt");
CREATE INDEX "MockInterviewSession_userId_status_createdAt_idx" ON "MockInterviewSession"("userId", "status", "createdAt");
CREATE INDEX "MockInterviewSession_careerId_createdAt_idx" ON "MockInterviewSession"("careerId", "createdAt");
CREATE UNIQUE INDEX "MockInterviewAnswer_sessionId_questionId_key" ON "MockInterviewAnswer"("sessionId", "questionId");
CREATE INDEX "MockInterviewAnswer_sessionId_submittedAt_idx" ON "MockInterviewAnswer"("sessionId", "submittedAt");

ALTER TABLE "MockInterviewSession" ADD CONSTRAINT "MockInterviewSession_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MockInterviewSession" ADD CONSTRAINT "MockInterviewSession_careerId_fkey"
FOREIGN KEY ("careerId") REFERENCES "Module4Career"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MockInterviewAnswer" ADD CONSTRAINT "MockInterviewAnswer_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "MockInterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

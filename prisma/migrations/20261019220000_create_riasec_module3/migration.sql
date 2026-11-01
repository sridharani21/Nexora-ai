CREATE TYPE "RiasecAttemptStatus" AS ENUM ('IN_PROGRESS', 'COMPLETE');

CREATE TABLE "RiasecAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "RiasecAttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "questionSetVersion" INTEGER NOT NULL DEFAULT 1,
    "scoringAlgorithmVersion" INTEGER NOT NULL DEFAULT 1,
    "questions" JSONB NOT NULL,
    "responses" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "scores" JSONB,
    "interestCode" TEXT,
    "interpretation" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RiasecAttempt_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RiasecAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "RiasecAttempt_userId_status_createdAt_idx"
ON "RiasecAttempt"("userId", "status", "createdAt");

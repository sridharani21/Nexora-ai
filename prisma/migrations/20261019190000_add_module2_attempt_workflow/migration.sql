CREATE TYPE "Module2AttemptStatus" AS ENUM (
    'GENERATING',
    'ACTIVE',
    'SUBMITTED',
    'EXPIRED',
    'GENERATION_FAILED'
);

CREATE TABLE "Module2Attempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "blueprintVersion" INTEGER NOT NULL,
    "blueprint" JSONB NOT NULL,
    "questions" JSONB,
    "answers" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "result" JSONB,
    "status" "Module2AttemptStatus" NOT NULL DEFAULT 'GENERATING',
    "startedAt" TIMESTAMP(3),
    "deadlineAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "completionReason" TEXT,
    "cameraConsent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Module2Attempt_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Module2Attempt_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Module2Attempt_branch_check"
        CHECK ("branch" IN ('CSE', 'IT', 'ECE', 'EEE', 'MECHANICAL', 'CIVIL')),
    CONSTRAINT "Module2Attempt_deadline_check"
        CHECK (
            ("status" = 'GENERATING' AND "startedAt" IS NULL AND "deadlineAt" IS NULL)
            OR
            ("status" <> 'GENERATING' AND "status" <> 'ACTIVE')
            OR
            ("status" = 'ACTIVE' AND "startedAt" IS NOT NULL AND "deadlineAt" > "startedAt")
        )
);

CREATE TABLE "Module2IntegrityEvent" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "clientOccurredAt" TIMESTAMP(3),
    "warningShown" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Module2IntegrityEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Module2IntegrityEvent_attemptId_fkey"
        FOREIGN KEY ("attemptId") REFERENCES "Module2Attempt"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Module2IntegrityEvent_severity_check"
        CHECK ("severity" IN ('INFO', 'WARNING', 'TECHNICAL'))
);

CREATE TABLE "Module2CodingSubmission" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "sourceCode" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "passed" INTEGER,
    "total" INTEGER,
    "evaluation" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Module2CodingSubmission_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Module2CodingSubmission_attemptId_fkey"
        FOREIGN KEY ("attemptId") REFERENCES "Module2Attempt"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Module2CodingSubmission_mode_check" CHECK ("mode" IN ('RUN', 'SUBMIT')),
    CONSTRAINT "Module2CodingSubmission_status_check"
        CHECK ("status" IN ('RUNNING', 'ACCEPTED', 'PARTIAL', 'FAILED', 'SERVICE_ERROR'))
);

CREATE INDEX "Module2Attempt_userId_createdAt_idx"
ON "Module2Attempt"("userId", "createdAt");

CREATE INDEX "Module2Attempt_status_deadlineAt_idx"
ON "Module2Attempt"("status", "deadlineAt");

CREATE UNIQUE INDEX "Module2Attempt_one_open_per_user_key"
ON "Module2Attempt"("userId")
WHERE "status" IN ('GENERATING', 'ACTIVE');

CREATE INDEX "Module2IntegrityEvent_attemptId_createdAt_idx"
ON "Module2IntegrityEvent"("attemptId", "createdAt");

CREATE INDEX "Module2CodingSubmission_attemptId_questionId_createdAt_idx"
ON "Module2CodingSubmission"("attemptId", "questionId", "createdAt");

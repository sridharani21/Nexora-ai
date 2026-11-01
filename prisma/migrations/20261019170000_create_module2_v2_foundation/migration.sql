CREATE TYPE "Module2QuestionStatus" AS ENUM ('GENERATED', 'VALIDATED', 'REJECTED', 'RELEASED');

CREATE TABLE "Module2Blueprint" (
    "id" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "maxMarks" DOUBLE PRECISION NOT NULL,
    "sections" JSONB NOT NULL,
    "scoringPolicy" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Module2Blueprint_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Module2Blueprint_branch_check"
        CHECK ("branch" IN ('CSE', 'IT', 'ECE', 'EEE', 'MECHANICAL', 'CIVIL')),
    CONSTRAINT "Module2Blueprint_version_check" CHECK ("version" > 0),
    CONSTRAINT "Module2Blueprint_duration_check" CHECK ("durationMinutes" = 60),
    CONSTRAINT "Module2Blueprint_marks_check" CHECK ("maxMarks" = 100)
);

CREATE TABLE "Module2Question" (
    "id" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "subtopic" TEXT,
    "difficulty" TEXT NOT NULL,
    "questionType" TEXT NOT NULL,
    "title" TEXT,
    "questionText" TEXT NOT NULL,
    "sampleExplanation" TEXT,
    "options" JSONB,
    "answerKey" TEXT,
    "explanation" TEXT NOT NULL,
    "inputFormat" TEXT,
    "outputFormat" TEXT,
    "constraints" TEXT,
    "starterCode" JSONB,
    "publicTestCases" JSONB,
    "privateTestCases" JSONB,
    "supportedLanguages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "marks" DOUBLE PRECISION NOT NULL,
    "negativeMarks" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "timeLimitSeconds" INTEGER,
    "memoryLimitMb" INTEGER,
    "sourceTitle" TEXT,
    "sourceUrl" TEXT,
    "languageVersion" TEXT,
    "generationModel" TEXT,
    "generationMetadata" JSONB,
    "validationMetadata" JSONB,
    "status" "Module2QuestionStatus" NOT NULL DEFAULT 'GENERATED',
    "contentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Module2Question_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Module2Question_branch_check"
        CHECK ("branch" IN ('CSE', 'IT', 'ECE', 'EEE', 'MECHANICAL', 'CIVIL')),
    CONSTRAINT "Module2Question_difficulty_check"
        CHECK ("difficulty" IN ('EASY', 'MEDIUM', 'HARD')),
    CONSTRAINT "Module2Question_type_check"
        CHECK ("questionType" IN ('MCQ', 'CODING')),
    CONSTRAINT "Module2Question_marks_check"
        CHECK ("marks" > 0 AND "negativeMarks" >= 0 AND "negativeMarks" <= "marks"),
    CONSTRAINT "Module2Question_version_check" CHECK ("contentVersion" > 0),
    CONSTRAINT "Module2Question_payload_check"
        CHECK (
            ("questionType" = 'MCQ' AND "options" IS NOT NULL
                AND "answerKey" IN ('A', 'B', 'C', 'D')
                AND "privateTestCases" IS NULL)
            OR
            ("questionType" = 'CODING' AND "options" IS NULL AND "answerKey" IS NULL
                AND "publicTestCases" IS NOT NULL AND "privateTestCases" IS NOT NULL
                AND "title" IS NOT NULL AND "sampleExplanation" IS NOT NULL
                AND "negativeMarks" = 0)
        ),
    CONSTRAINT "Module2Question_release_check"
        CHECK (
            "status" <> 'RELEASED'
            OR (
                COALESCE("validationMetadata"->>'independentFactualReview', '') = 'passed'
                AND COALESCE(NULLIF("validationMetadata"->>'reviewedBy', ''), '') <> ''
                AND COALESCE(NULLIF("validationMetadata"->>'reviewMethod', ''), '') <> ''
                AND (
                    "questionType" <> 'CODING'
                    OR COALESCE("validationMetadata"->>'sandboxAllTestsPassed', 'false') = 'true'
                )
            )
        )
);

CREATE UNIQUE INDEX "Module2Blueprint_branch_version_key"
ON "Module2Blueprint"("branch", "version");

CREATE INDEX "Module2Blueprint_branch_isActive_idx"
ON "Module2Blueprint"("branch", "isActive");

CREATE UNIQUE INDEX "Module2Question_contentHash_key"
ON "Module2Question"("contentHash");

CREATE INDEX "Module2Question_branch_status_questionType_idx"
ON "Module2Question"("branch", "status", "questionType");

CREATE INDEX "Module2Question_branch_subject_topic_difficulty_idx"
ON "Module2Question"("branch", "subject", "topic", "difficulty");

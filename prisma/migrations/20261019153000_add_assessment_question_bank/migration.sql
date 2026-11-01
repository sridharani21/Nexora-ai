CREATE TABLE "AssessmentQuestion" (
    "id" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "branches" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "subject" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "subtopic" TEXT,
    "difficulty" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "options" JSONB,
    "answerKey" TEXT,
    "explanation" TEXT,
    "inputFormat" TEXT,
    "outputFormat" TEXT,
    "constraints" TEXT,
    "starterCode" JSONB,
    "publicTestCases" JSONB,
    "privateTestCases" JSONB,
    "supportedLanguages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "marks" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "negativeMarks" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "timeLimitSeconds" INTEGER,
    "memoryLimitMb" INTEGER,
    "sourceTitle" TEXT,
    "sourceUrl" TEXT,
    "languageVersion" TEXT,
    "generationModel" TEXT,
    "validationMetadata" JSONB,
    "validationStatus" TEXT NOT NULL DEFAULT 'GENERATED',
    "isReleased" BOOLEAN NOT NULL DEFAULT false,
    "contentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AssessmentQuestion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AssessmentQuestion_type_check"
        CHECK ("type" IN ('MCQ', 'CODING')),
    CONSTRAINT "AssessmentQuestion_difficulty_check"
        CHECK ("difficulty" IN ('EASY', 'MEDIUM', 'HARD')),
    CONSTRAINT "AssessmentQuestion_validationStatus_check"
        CHECK ("validationStatus" IN ('GENERATED', 'VALIDATED', 'REJECTED')),
    CONSTRAINT "AssessmentQuestion_release_check"
        CHECK (NOT "isReleased" OR "validationStatus" = 'VALIDATED'),
    CONSTRAINT "AssessmentQuestion_marks_check"
        CHECK ("marks" > 0 AND "negativeMarks" >= 0 AND "negativeMarks" <= "marks"),
    CONSTRAINT "AssessmentQuestion_contentVersion_check"
        CHECK ("contentVersion" > 0),
    CONSTRAINT "AssessmentQuestion_payload_check"
        CHECK (
            ("type" = 'MCQ' AND "options" IS NOT NULL AND "answerKey" IN ('A', 'B', 'C', 'D'))
            OR
            ("type" = 'CODING' AND "options" IS NULL AND "answerKey" IS NULL
                AND "publicTestCases" IS NOT NULL AND "privateTestCases" IS NOT NULL)
        )
);

CREATE UNIQUE INDEX "AssessmentQuestion_contentHash_key"
ON "AssessmentQuestion"("contentHash");

CREATE INDEX "AssessmentQuestion_validationStatus_isReleased_idx"
ON "AssessmentQuestion"("validationStatus", "isReleased");

CREATE INDEX "AssessmentQuestion_subject_topic_difficulty_idx"
ON "AssessmentQuestion"("subject", "topic", "difficulty");

ALTER TABLE "PrepGeneratedQuestionSet"
ADD COLUMN "assessmentVersion" TEXT,
ADD COLUMN "expiresAt" TIMESTAMP(3),
ADD COLUMN "draftAnswers" TEXT NOT NULL DEFAULT '{}',
ADD COLUMN "interestResponses" TEXT NOT NULL DEFAULT '{}',
ADD COLUMN "codingDrafts" TEXT NOT NULL DEFAULT '{}',
ADD COLUMN "codingLanguages" TEXT NOT NULL DEFAULT '{}';

CREATE UNIQUE INDEX "PrepGeneratedQuestionSet_one_active_module2_per_profile_key"
ON "PrepGeneratedQuestionSet"("profileId")
WHERE "purpose" = 'module2-initial' AND "usedAt" IS NULL;

ALTER TABLE "PrepAssessmentAttempt"
ADD COLUMN "assessmentType" TEXT NOT NULL DEFAULT 'diagnostic',
ADD COLUMN "questionSetId" TEXT;

CREATE UNIQUE INDEX "PrepAssessmentAttempt_questionSetId_key"
ON "PrepAssessmentAttempt"("questionSetId");

CREATE TABLE "PrepAssessmentCodingSubmission" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "questionSetId" TEXT NOT NULL,
    "questionSlug" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "sourceCode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "passedTestCases" INTEGER NOT NULL,
    "totalTestCases" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "executionTimeMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PrepAssessmentCodingSubmission_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PrepAssessmentCodingSubmission_profileId_createdAt_idx"
ON "PrepAssessmentCodingSubmission"("profileId", "createdAt");
CREATE INDEX "PrepAssessmentCodingSubmission_questionSetId_questionSlug_createdAt_idx"
ON "PrepAssessmentCodingSubmission"("questionSetId", "questionSlug", "createdAt");

ALTER TABLE "PrepAssessmentCodingSubmission"
ADD CONSTRAINT "PrepAssessmentCodingSubmission_profileId_fkey"
FOREIGN KEY ("profileId") REFERENCES "PrepStudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

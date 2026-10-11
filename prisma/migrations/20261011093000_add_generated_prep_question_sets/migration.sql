CREATE TABLE "PrepGeneratedQuestionSet" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "questions" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrepGeneratedQuestionSet_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PrepGeneratedQuestionSet_profileId_createdAt_idx"
ON "PrepGeneratedQuestionSet"("profileId", "createdAt");

ALTER TABLE "PrepGeneratedQuestionSet"
ADD CONSTRAINT "PrepGeneratedQuestionSet_profileId_fkey"
FOREIGN KEY ("profileId") REFERENCES "PrepStudentProfile"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PrepPracticeAttempt"
ADD COLUMN "questionData" TEXT NOT NULL DEFAULT '[]';

ALTER TABLE "PrepGeneratedQuestionSet"
ADD COLUMN "usedAt" TIMESTAMP(3);

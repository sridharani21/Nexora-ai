ALTER TABLE "PrepGeneratedQuestionSet"
ALTER COLUMN "profileId" DROP NOT NULL;

ALTER TABLE "PrepGeneratedQuestionSet"
ADD COLUMN "ownerId" TEXT;

UPDATE "PrepGeneratedQuestionSet" AS question_set
SET "ownerId" = profile."clerkUserId"
FROM "PrepStudentProfile" AS profile
WHERE question_set."profileId" = profile."id";

ALTER TABLE "PrepGeneratedQuestionSet"
ALTER COLUMN "ownerId" SET NOT NULL;

CREATE INDEX "PrepGeneratedQuestionSet_ownerId_createdAt_idx"
ON "PrepGeneratedQuestionSet"("ownerId", "createdAt");

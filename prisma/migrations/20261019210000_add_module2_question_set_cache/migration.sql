CREATE TABLE "Module2QuestionSetCache" (
    "id" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "blueprintVersion" INTEGER NOT NULL,
    "questions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Module2QuestionSetCache_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Module2QuestionSetCache_branch_blueprintVersion_createdAt_idx"
ON "Module2QuestionSetCache"("branch", "blueprintVersion", "createdAt");

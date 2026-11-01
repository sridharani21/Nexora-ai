ALTER TABLE "Module2Attempt"
    ADD COLUMN "leaderboardOptIn" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "questionTime" JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN "cooldownUntil" TIMESTAMP(3);

CREATE INDEX "Module2Attempt_userId_cooldownUntil_idx"
ON "Module2Attempt"("userId", "cooldownUntil");

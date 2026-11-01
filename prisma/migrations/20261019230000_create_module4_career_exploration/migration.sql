CREATE TABLE "Module4Career" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "responsibilities" JSONB NOT NULL,
    "workEnvironments" JSONB NOT NULL,
    "entryLevelRoles" JSONB NOT NULL,
    "tools" JSONB NOT NULL,
    "educationThemes" JSONB NOT NULL,
    "projectIdeas" JSONB NOT NULL,
    "qualifications" JSONB NOT NULL,
    "interestDimensions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "technicalTopics" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "adjacentSlugs" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "sources" JSONB NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Module4Career_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Module4Career_slug_key" ON "Module4Career"("slug");
CREATE INDEX "Module4Career_family_isActive_idx" ON "Module4Career"("family", "isActive");
CREATE INDEX "Module4Career_domain_isActive_idx" ON "Module4Career"("domain", "isActive");

CREATE TABLE "Module4CareerSkill" (
    "id" TEXT NOT NULL,
    "careerId" TEXT NOT NULL,
    "skillName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "importance" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "evidenceTopics" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "sourceLabel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Module4CareerSkill_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Module4CareerSkill_careerId_fkey" FOREIGN KEY ("careerId") REFERENCES "Module4Career"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Module4CareerSkill_careerId_normalizedName_key" ON "Module4CareerSkill"("careerId", "normalizedName");
CREATE INDEX "Module4CareerSkill_normalizedName_idx" ON "Module4CareerSkill"("normalizedName");

CREATE TABLE "Module4RecommendationRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rankingMethod" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "featureSchemaVersion" TEXT NOT NULL,
    "dataSnapshot" JSONB NOT NULL,
    "limitations" JSONB NOT NULL,
    "explanationProvider" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Module4RecommendationRun_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Module4RecommendationRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Module4RecommendationRun_userId_createdAt_idx" ON "Module4RecommendationRun"("userId", "createdAt");

CREATE TABLE "Module4CareerRecommendation" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "careerId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "evidence" JSONB NOT NULL,
    "explanation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Module4CareerRecommendation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Module4CareerRecommendation_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Module4RecommendationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Module4CareerRecommendation_careerId_fkey" FOREIGN KEY ("careerId") REFERENCES "Module4Career"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Module4CareerRecommendation_runId_careerId_key" ON "Module4CareerRecommendation"("runId", "careerId");
CREATE UNIQUE INDEX "Module4CareerRecommendation_runId_rank_key" ON "Module4CareerRecommendation"("runId", "rank");
CREATE INDEX "Module4CareerRecommendation_careerId_createdAt_idx" ON "Module4CareerRecommendation"("careerId", "createdAt");

CREATE TABLE "Module4SavedCareer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "careerId" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Module4SavedCareer_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Module4SavedCareer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Module4SavedCareer_careerId_fkey" FOREIGN KEY ("careerId") REFERENCES "Module4Career"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Module4SavedCareer_userId_careerId_key" ON "Module4SavedCareer"("userId", "careerId");
CREATE INDEX "Module4SavedCareer_userId_createdAt_idx" ON "Module4SavedCareer"("userId", "createdAt");

CREATE TABLE "Module4CareerPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "domains" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "interests" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "goals" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Module4CareerPreference_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Module4CareerPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Module4CareerPreference_userId_key" ON "Module4CareerPreference"("userId");

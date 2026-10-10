CREATE TABLE "PlacementJourney" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'profile',
    "currentModule" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlacementJourney_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StudentProfile" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "educationLevel" TEXT,
    "institution" TEXT,
    "degree" TEXT,
    "graduationYear" INTEGER,
    "cgpa" TEXT,
    "academicDetails" TEXT,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "programmingLanguages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "projects" JSONB,
    "certifications" JSONB,
    "resumeUrl" TEXT,
    "resumeText" TEXT,
    "careerInterests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredRole" TEXT,
    "targetCompany" TEXT,
    "companyType" TEXT,
    "preferredLocations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "profileCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlacementJourney_userId_key" ON "PlacementJourney"("userId");
CREATE UNIQUE INDEX "StudentProfile_journeyId_key" ON "StudentProfile"("journeyId");
ALTER TABLE "PlacementJourney" ADD CONSTRAINT "PlacementJourney_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_journeyId_fkey"
  FOREIGN KEY ("journeyId") REFERENCES "PlacementJourney"("id") ON DELETE CASCADE ON UPDATE CASCADE;

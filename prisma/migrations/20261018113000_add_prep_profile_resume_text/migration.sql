ALTER TABLE "PrepStudentProfile"
ADD COLUMN "resumeText" TEXT,
ADD COLUMN "resumeFileName" TEXT,
ADD COLUMN "resumeMimeType" TEXT,
ADD COLUMN "resumeFileSizeBytes" INTEGER,
ADD COLUMN "resumeUploadedAt" TIMESTAMP(3);

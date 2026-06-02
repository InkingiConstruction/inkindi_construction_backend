CREATE TYPE "ProgressReviewStatus" AS ENUM ('pending', 'approved', 'rejected');

ALTER TABLE "progress_photo"
ADD COLUMN "reviewStatus" "ProgressReviewStatus" NOT NULL DEFAULT 'pending',
ADD COLUMN "supervisorComment" TEXT,
ADD COLUMN "reviewedById" TEXT,
ADD COLUMN "reviewedAt" TIMESTAMP(3);

CREATE INDEX "progress_photo_reviewStatus_idx" ON "progress_photo"("reviewStatus");

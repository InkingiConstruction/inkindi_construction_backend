ALTER TABLE "progress_photo" ADD COLUMN "progressGroupId" TEXT;
CREATE INDEX "progress_photo_progressGroupId_idx" ON "progress_photo"("progressGroupId");

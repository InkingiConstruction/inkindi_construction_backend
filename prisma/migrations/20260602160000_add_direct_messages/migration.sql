ALTER TABLE "message" ALTER COLUMN "projectId" DROP NOT NULL;

ALTER TABLE "message" ADD COLUMN "recipientId" TEXT;

CREATE INDEX "message_recipientId_idx" ON "message"("recipientId");

ALTER TABLE "message" ADD CONSTRAINT "message_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

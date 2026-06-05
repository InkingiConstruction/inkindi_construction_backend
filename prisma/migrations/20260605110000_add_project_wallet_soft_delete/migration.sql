ALTER TABLE "escrow_account"
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "escrow_account_status_idx" ON "escrow_account"("status");
CREATE INDEX "escrow_account_deletedAt_idx" ON "escrow_account"("deletedAt");

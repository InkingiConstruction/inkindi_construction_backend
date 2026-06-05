CREATE TABLE "site_daily_report" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "siteAgentId" TEXT NOT NULL,
  "weather" TEXT NOT NULL,
  "workforceCount" INTEGER NOT NULL,
  "taskProgress" TEXT NOT NULL,
  "notes" TEXT,
  "evidence" JSONB NOT NULL DEFAULT '[]',
  "reportDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "site_daily_report_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "site_inventory_log" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "siteAgentId" TEXT NOT NULL,
  "material" TEXT NOT NULL,
  "unit" TEXT,
  "quantity" DECIMAL(15,2) NOT NULL,
  "direction" TEXT NOT NULL DEFAULT 'consumed',
  "notes" TEXT,
  "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "site_inventory_log_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "delivery_verification" (
  "id" TEXT NOT NULL,
  "deliveryId" TEXT,
  "projectId" TEXT NOT NULL,
  "siteAgentId" TEXT NOT NULL,
  "deliveryCode" TEXT NOT NULL,
  "pin" TEXT NOT NULL,
  "remarks" TEXT,
  "receiptPhotos" JSONB NOT NULL DEFAULT '[]',
  "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "delivery_verification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "site_daily_report_projectId_idx" ON "site_daily_report"("projectId");
CREATE INDEX "site_daily_report_siteAgentId_idx" ON "site_daily_report"("siteAgentId");
CREATE INDEX "site_daily_report_reportDate_idx" ON "site_daily_report"("reportDate");

CREATE INDEX "site_inventory_log_projectId_idx" ON "site_inventory_log"("projectId");
CREATE INDEX "site_inventory_log_siteAgentId_idx" ON "site_inventory_log"("siteAgentId");
CREATE INDEX "site_inventory_log_material_idx" ON "site_inventory_log"("material");

CREATE INDEX "delivery_verification_deliveryId_idx" ON "delivery_verification"("deliveryId");
CREATE INDEX "delivery_verification_projectId_idx" ON "delivery_verification"("projectId");
CREATE INDEX "delivery_verification_siteAgentId_idx" ON "delivery_verification"("siteAgentId");
CREATE INDEX "delivery_verification_deliveryCode_idx" ON "delivery_verification"("deliveryCode");

ALTER TABLE "site_daily_report"
  ADD CONSTRAINT "site_daily_report_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "site_daily_report"
  ADD CONSTRAINT "site_daily_report_siteAgentId_fkey"
  FOREIGN KEY ("siteAgentId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "site_inventory_log"
  ADD CONSTRAINT "site_inventory_log_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "site_inventory_log"
  ADD CONSTRAINT "site_inventory_log_siteAgentId_fkey"
  FOREIGN KEY ("siteAgentId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "delivery_verification"
  ADD CONSTRAINT "delivery_verification_deliveryId_fkey"
  FOREIGN KEY ("deliveryId") REFERENCES "delivery"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "delivery_verification"
  ADD CONSTRAINT "delivery_verification_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "delivery_verification"
  ADD CONSTRAINT "delivery_verification_siteAgentId_fkey"
  FOREIGN KEY ("siteAgentId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

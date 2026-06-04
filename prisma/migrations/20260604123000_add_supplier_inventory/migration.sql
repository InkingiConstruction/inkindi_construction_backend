ALTER TABLE "milestone" ALTER COLUMN "budgetPercentage" SET DEFAULT 0;

CREATE TABLE "supplier_inventory_item" (
  "id" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "unit" TEXT NOT NULL,
  "unitPrice" DECIMAL(15,2) NOT NULL,
  "deliveryFee" DECIMAL(15,2),
  "available" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "supplier_inventory_item_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "supplier_inventory_item_supplierId_idx" ON "supplier_inventory_item"("supplierId");
CREATE INDEX "supplier_inventory_item_category_idx" ON "supplier_inventory_item"("category");
CREATE INDEX "supplier_inventory_item_available_idx" ON "supplier_inventory_item"("available");

ALTER TABLE "supplier_inventory_item" ADD CONSTRAINT "supplier_inventory_item_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "boq_item" ADD COLUMN "supplierInventoryItemId" TEXT;
CREATE INDEX "boq_item_supplierInventoryItemId_idx" ON "boq_item"("supplierInventoryItemId");
ALTER TABLE "boq_item" ADD CONSTRAINT "boq_item_supplierInventoryItemId_fkey" FOREIGN KEY ("supplierInventoryItemId") REFERENCES "supplier_inventory_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

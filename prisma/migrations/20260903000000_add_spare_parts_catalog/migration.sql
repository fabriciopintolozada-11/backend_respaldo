ALTER TABLE "spare_parts"
  ADD COLUMN "category" VARCHAR(40) NOT NULL DEFAULT 'MOTOR',
  ADD COLUMN "last_movement_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "stock_movements"
  ALTER COLUMN "work_order_id" DROP NOT NULL,
  ADD COLUMN "reason" TEXT,
  ADD COLUMN "previous_physical_stock" INTEGER,
  ADD COLUMN "new_physical_stock" INTEGER;

CREATE INDEX "spare_parts_category_idx" ON "spare_parts"("category");
CREATE INDEX "spare_parts_name_idx" ON "spare_parts"("name");
CREATE INDEX "spare_parts_last_movement_at_idx" ON "spare_parts"("last_movement_at");

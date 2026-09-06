-- The base schema was normalized by 20260824000000_sync_feature_first_schema.
-- Keep only the feature tables here; never drop or recreate the normalized core.
CREATE TABLE "spare_parts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "spare_parts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "quotes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "work_order_id" UUID NOT NULL,
    "labor_items" JSONB NOT NULL,
    "labor_subtotal" DECIMAL(12,2) NOT NULL,
    "parts_subtotal" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'BOB',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "quote_parts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "quote_id" UUID NOT NULL,
    "spare_part_id" UUID NOT NULL,
    "quantity" SMALLINT NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    CONSTRAINT "quote_parts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "diagnostics" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "work_order_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "suggested_tasks" JSONB NOT NULL,
    "suggested_part_ids" JSONB NOT NULL,
    "estimated_hours" DECIMAL(8,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "diagnostics_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "spare_parts_code_key" ON "spare_parts"("code");
CREATE UNIQUE INDEX "quotes_work_order_id_key" ON "quotes"("work_order_id");
CREATE UNIQUE INDEX "quote_parts_quote_id_spare_part_id_key" ON "quote_parts"("quote_id", "spare_part_id");
CREATE UNIQUE INDEX "diagnostics_work_order_id_key" ON "diagnostics"("work_order_id");

ALTER TABLE "quotes" ADD CONSTRAINT "quotes_work_order_id_fkey"
  FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quote_parts" ADD CONSTRAINT "quote_parts_quote_id_fkey"
  FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quote_parts" ADD CONSTRAINT "quote_parts_spare_part_id_fkey"
  FOREIGN KEY ("spare_part_id") REFERENCES "spare_parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "diagnostics" ADD CONSTRAINT "diagnostics_work_order_id_fkey"
  FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- US-20 / RN-15: insert-only settlement adjustments (discounts and voids).
CREATE TABLE "settlement_adjustments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "work_order_id" UUID NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "applied_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    CONSTRAINT "settlement_adjustments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "settlement_adjustments_work_order_id_idx" ON "settlement_adjustments"("work_order_id");
ALTER TABLE "settlement_adjustments" ADD CONSTRAINT "settlement_adjustments_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

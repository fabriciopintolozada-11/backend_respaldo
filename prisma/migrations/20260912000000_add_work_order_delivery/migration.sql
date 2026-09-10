-- US-20: persist settlement / delivery data of a work order (RN-21, RN-19).
-- Additive nullable columns: no existing column, index or relation changes.
ALTER TABLE "work_orders" ADD COLUMN "delivered_at" TIMESTAMPTZ(6);
ALTER TABLE "work_orders" ADD COLUMN "payment_method" VARCHAR(20);
ALTER TABLE "work_orders" ADD COLUMN "receipt_number" VARCHAR(50);
ALTER TABLE "work_orders" ADD COLUMN "total_charged" DECIMAL(12,2);
ALTER TABLE "work_orders" ADD COLUMN "delivery_notes" TEXT;
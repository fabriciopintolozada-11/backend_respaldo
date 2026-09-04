-- CreateTable
CREATE TABLE "inventory_discrepancies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "work_order_id" UUID NOT NULL,
    "spare_part_id" UUID NOT NULL,
    "reported_by" UUID NOT NULL,
    "quantity" SMALLINT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "resolved_at" TIMESTAMPTZ(6),
    "resolved_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "inventory_discrepancies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inventory_discrepancies_work_order_id_idx" ON "inventory_discrepancies"("work_order_id");

-- CreateIndex
CREATE INDEX "inventory_discrepancies_spare_part_id_idx" ON "inventory_discrepancies"("spare_part_id");

-- CreateIndex
CREATE INDEX "inventory_discrepancies_status_idx" ON "inventory_discrepancies"("status");

-- AddForeignKey
ALTER TABLE "inventory_discrepancies" ADD CONSTRAINT "inventory_discrepancies_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_discrepancies" ADD CONSTRAINT "inventory_discrepancies_spare_part_id_fkey" FOREIGN KEY ("spare_part_id") REFERENCES "spare_parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_discrepancies" ADD CONSTRAINT "inventory_discrepancies_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

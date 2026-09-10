-- CreateTable
CREATE TABLE "work_bays" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "bay_number" INTEGER NOT NULL,
    "is_occupied" BOOLEAN NOT NULL DEFAULT false,
    "current_work_order_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "work_bays_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "work_bays_bay_number_key" ON "work_bays"("bay_number");

-- CreateIndex
CREATE UNIQUE INDEX "work_bays_current_work_order_id_key" ON "work_bays"("current_work_order_id");

-- CreateIndex
CREATE INDEX "work_bays_bay_number_idx" ON "work_bays"("bay_number");

-- AddForeignKey
ALTER TABLE "work_bays" ADD CONSTRAINT "work_bays_current_work_order_id_fkey" FOREIGN KEY ("current_work_order_id") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
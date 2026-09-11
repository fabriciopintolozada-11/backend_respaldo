-- US-21 / BE-T21.2: annex of an active work order for an unforeseen failure
-- (falla imprevista) reported by a mechanic during repair (HU-11 / RN-03).
-- Insert is immutable; only the decision fields and status ever change (BE-17).
-- CreateTable
CREATE TABLE "additional_findings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "work_order_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "suggested_tasks" JSONB NOT NULL,
    "suggested_part_ids" JSONB NOT NULL,
    "estimated_hours" DECIMAL(8,2) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING_QUOTE',
    "reported_by" UUID NOT NULL,
    "decided_by" UUID,
    "decided_at" TIMESTAMPTZ(6),
    "channel" VARCHAR(20),
    "customer_name" VARCHAR(150),
    "notes" TEXT,
    "rejection_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "additional_findings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "additional_findings_work_order_id_status_idx" ON "additional_findings"("work_order_id", "status");

-- CreateIndex
CREATE INDEX "additional_findings_work_order_id_created_at_idx" ON "additional_findings"("work_order_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "additional_findings" ADD CONSTRAINT "additional_findings_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "additional_findings" ADD CONSTRAINT "additional_findings_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "additional_findings" ADD CONSTRAINT "additional_findings_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
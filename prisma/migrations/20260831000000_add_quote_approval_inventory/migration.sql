-- Add inventory balances used by quote approval reservations.
ALTER TABLE "spare_parts"
    ADD COLUMN "physical_stock" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "available_stock" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "reserved_stock" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "quote_parts"
    ADD COLUMN "status" VARCHAR(20) NOT NULL DEFAULT 'PROPOSED';

CREATE TABLE "quote_approvals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "quote_id" UUID NOT NULL,
    "decision" VARCHAR(20) NOT NULL,
    "channel" VARCHAR(20),
    "customer_name" VARCHAR(150),
    "notes" TEXT,
    "reason" TEXT,
    "recorded_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "quote_approvals_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "quote_approvals_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "quote_approvals_quote_id_created_at_idx" ON "quote_approvals"("quote_id", "created_at" DESC);

CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "recipient_id" UUID NOT NULL,
    "work_order_id" UUID NOT NULL,
    "type" VARCHAR(40) NOT NULL,
    "message" TEXT NOT NULL,
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "notifications_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "notifications_recipient_id_read_at_idx" ON "notifications"("recipient_id", "read_at");

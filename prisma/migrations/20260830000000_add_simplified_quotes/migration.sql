-- Make legacy quote columns nullable (the schema evolved from HU-12).
ALTER TABLE "quotes"
    ALTER COLUMN "labor_items" DROP NOT NULL,
    ALTER COLUMN "labor_subtotal" DROP NOT NULL,
    ALTER COLUMN "parts_subtotal" DROP NOT NULL;

-- Create the detail lines table for simplified quotes.
CREATE TABLE "quote_details" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "quote_id" UUID NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "item_type" VARCHAR(20) NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    CONSTRAINT "quote_details_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "quote_details_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "quote_details_quote_id_idx" ON "quote_details"("quote_id");

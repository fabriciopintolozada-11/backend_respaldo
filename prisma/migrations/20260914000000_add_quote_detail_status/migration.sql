-- BE-E06 / HU-21: quote details are soft-deletable so a re-quote can supersede
-- the active lines instead of physically deleting them (append-only budget).
ALTER TABLE "quote_details"
    ADD COLUMN "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';

CREATE INDEX "quote_details_quote_id_status_idx" ON "quote_details"("quote_id", "status");
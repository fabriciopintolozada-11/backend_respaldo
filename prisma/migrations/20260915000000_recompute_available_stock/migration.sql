-- BE-E02 / DB-E02: recompute the persisted available_stock from physical and
-- reserved stock, repairing the drift caused by the legacy double decrement in
-- consumePart (available was decremented again on consumption even though the
-- reservation already moved the units) and by inventory adjustments that never
-- touched the column. From now on the column is kept synchronized, so the
-- RN-07 invariant available = physical - reserved holds for every row.
UPDATE "spare_parts"
SET "available_stock" = "physical_stock" - "reserved_stock";
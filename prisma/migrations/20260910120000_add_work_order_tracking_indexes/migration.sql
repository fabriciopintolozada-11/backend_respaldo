-- BE-T05.4: composite indexes for the US-05 tracking-summary (status filter +
-- recency ordering) and the vehicle history lookup (vehicle + delivered state).
-- CreateIndex
CREATE INDEX "work_orders_status_created_at_idx" ON "work_orders"("status", "created_at");

-- CreateIndex
CREATE INDEX "work_orders_vehicle_id_status_idx" ON "work_orders"("vehicle_id", "status");
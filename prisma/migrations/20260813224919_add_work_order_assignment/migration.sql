-- AlterTable
ALTER TABLE "WorkOrder" ADD COLUMN     "assignedAt" TIMESTAMPTZ(6),
ADD COLUMN     "mechanicId" UUID;

-- CreateIndex
CREATE INDEX "WorkOrder_mechanicId_idx" ON "WorkOrder"("mechanicId");

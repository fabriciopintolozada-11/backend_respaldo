-- DropForeignKey
ALTER TABLE "stock_movements" DROP CONSTRAINT "stock_movements_work_order_id_fkey";

-- AlterTable
ALTER TABLE "customers" RENAME CONSTRAINT "Customer_pkey" TO "customers_pkey";

-- AlterTable
ALTER TABLE "mechanics" RENAME CONSTRAINT "Mechanic_pkey" TO "mechanics_pkey";

-- AlterTable
ALTER TABLE "quotes" ALTER COLUMN "labor_items" DROP NOT NULL,
ALTER COLUMN "labor_subtotal" DROP NOT NULL,
ALTER COLUMN "parts_subtotal" DROP NOT NULL;

-- AlterTable
ALTER TABLE "technical_histories" RENAME CONSTRAINT "TechnicalHistory_pkey" TO "technical_histories_pkey";

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "vehicles" RENAME CONSTRAINT "Vehicle_pkey" TO "vehicles_pkey";

-- AlterTable
ALTER TABLE "work_orders" RENAME CONSTRAINT "WorkOrder_pkey" TO "work_orders_pkey";

-- RenameForeignKey
ALTER TABLE "technical_histories" RENAME CONSTRAINT "TechnicalHistory_vehicleId_fkey" TO "technical_histories_vehicle_id_fkey";

-- RenameForeignKey
ALTER TABLE "vehicles" RENAME CONSTRAINT "Vehicle_customerId_fkey" TO "vehicles_customer_id_fkey";

-- RenameForeignKey
ALTER TABLE "work_orders" RENAME CONSTRAINT "WorkOrder_customerId_fkey" TO "work_orders_customer_id_fkey";

-- RenameForeignKey
ALTER TABLE "work_orders" RENAME CONSTRAINT "WorkOrder_mechanicId_fkey" TO "work_orders_mechanic_id_fkey";

-- RenameForeignKey
ALTER TABLE "work_orders" RENAME CONSTRAINT "WorkOrder_vehicleId_fkey" TO "work_orders_vehicle_id_fkey";

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "Customer_identification_key" RENAME TO "customers_identification_key";

-- RenameIndex
ALTER INDEX "Vehicle_plate_key" RENAME TO "vehicles_license_plate_key";

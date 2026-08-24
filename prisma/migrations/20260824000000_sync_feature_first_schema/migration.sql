-- Consolidate the historical Prisma schema with the feature-first snake_case schema.
-- This migration is safe for a clean deployment and for an existing snake_case database.
DO $$
BEGIN
  IF to_regclass('"Customer"') IS NOT NULL AND to_regclass('customers') IS NULL THEN
    ALTER TABLE "Customer" RENAME TO customers;
  END IF;
  IF to_regclass('"Vehicle"') IS NOT NULL AND to_regclass('vehicles') IS NULL THEN
    ALTER TABLE "Vehicle" RENAME TO vehicles;
  END IF;
  IF to_regclass('"WorkOrder"') IS NOT NULL AND to_regclass('work_orders') IS NULL THEN
    ALTER TABLE "WorkOrder" RENAME TO work_orders;
  END IF;
  IF to_regclass('"Mechanic"') IS NOT NULL AND to_regclass('mechanics') IS NULL THEN
    ALTER TABLE "Mechanic" RENAME TO mechanics;
  END IF;
  IF to_regclass('"TechnicalHistory"') IS NOT NULL AND to_regclass('technical_histories') IS NULL THEN
    ALTER TABLE "TechnicalHistory" RENAME TO technical_histories;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'identification') THEN
    NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'customerId') THEN
    ALTER TABLE vehicles RENAME COLUMN "customerId" TO customer_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'plate') THEN
    ALTER TABLE vehicles RENAME COLUMN plate TO license_plate;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'isFullyElectric') THEN
    ALTER TABLE vehicles RENAME COLUMN "isFullyElectric" TO is_fully_electric;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'vehicleId') THEN
    ALTER TABLE work_orders RENAME COLUMN "vehicleId" TO vehicle_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'customerId') THEN
    ALTER TABLE work_orders RENAME COLUMN "customerId" TO customer_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'receptionistId') THEN
    ALTER TABLE work_orders RENAME COLUMN "receptionistId" TO receptionist_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'initialComplaint') THEN
    ALTER TABLE work_orders RENAME COLUMN "initialComplaint" TO initial_complaint;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'mechanicId') THEN
    ALTER TABLE work_orders RENAME COLUMN "mechanicId" TO mechanic_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'assignedAt') THEN
    ALTER TABLE work_orders RENAME COLUMN "assignedAt" TO assigned_at;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'createdAt') THEN
    ALTER TABLE work_orders RENAME COLUMN "createdAt" TO created_at;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'updatedAt') THEN
    ALTER TABLE work_orders RENAME COLUMN "updatedAt" TO updated_at;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'technical_histories' AND column_name = 'vehicleId') THEN
    ALTER TABLE technical_histories RENAME COLUMN "vehicleId" TO vehicle_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'technical_histories' AND column_name = 'createdAt') THEN
    ALTER TABLE technical_histories RENAME COLUMN "createdAt" TO created_at;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mechanics' AND column_name = 'isActive') THEN
    ALTER TABLE mechanics RENAME COLUMN "isActive" TO is_active;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS vehicles_license_plate_idx ON vehicles (license_plate);
CREATE INDEX IF NOT EXISTS work_orders_vehicle_id_idx ON work_orders (vehicle_id);
CREATE INDEX IF NOT EXISTS work_orders_status_idx ON work_orders (status);
CREATE INDEX IF NOT EXISTS work_orders_mechanic_id_idx ON work_orders (mechanic_id);
CREATE INDEX IF NOT EXISTS technical_histories_vehicle_id_created_at_idx
  ON technical_histories (vehicle_id, created_at DESC);

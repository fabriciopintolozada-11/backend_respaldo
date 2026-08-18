CREATE TABLE "Mechanic" (
    "id" UUID NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Mechanic_pkey" PRIMARY KEY ("id")
);

INSERT INTO "Mechanic" ("id")
SELECT DISTINCT "mechanicId"
FROM "WorkOrder"
WHERE "mechanicId" IS NOT NULL;

ALTER TABLE "WorkOrder" ADD COLUMN "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_mechanicId_fkey"
    FOREIGN KEY ("mechanicId") REFERENCES "Mechanic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- BE-P02-6 / #15: migrate work order statuses to the English vocabulary.
-- The old Spanish values were dropped from the codebase and replaced by the
-- English ones documented in the merge request description (FE contract).
UPDATE "work_orders"
SET "status" = CASE "status"
    WHEN 'RECIBIDO' THEN 'RECEIVED'
    WHEN 'ASIGNADA' THEN 'ASSIGNED'
    WHEN 'EN_DIAGNOSTICO' THEN 'IN_DIAGNOSIS'
    WHEN 'PRESUPUESTO_ENVIADO' THEN 'QUOTE_SENT'
    WHEN 'APROBADO' THEN 'APPROVED'
    WHEN 'EN_REPARACION' THEN 'IN_REPAIR'
    WHEN 'EN_ESPERA_DE_REPUESTO' THEN 'WAITING_FOR_PART'
    WHEN 'LISTO_ENTREGA' THEN 'READY_FOR_DELIVERY'
    WHEN 'FINALIZADO' THEN 'FINALIZED'
    WHEN 'ENTREGADO' THEN 'DELIVERED'
    WHEN 'RECHAZADO' THEN 'REJECTED'
    ELSE "status"
END;

ALTER TABLE "work_orders" ALTER COLUMN "status" SET DEFAULT 'RECEIVED';

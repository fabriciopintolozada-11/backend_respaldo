export const WORK_ORDER_STAGES: Record<string, string> = {
  RECIBIDO: 'Recibido',
  EN_REPARACION: 'En reparación',
  ESPERANDO_REPUESTO: 'Esperando repuesto',
  FINALIZADO: 'Finalizado',
  LISTO_ENTREGA: 'Listo para entrega',
};

export function getWorkOrderStage(status: string): string {
  return WORK_ORDER_STAGES[status] ?? status;
}

export function isVehicleReadyForPickup(status: string): boolean {
  return status === 'FINALIZADO' || status === 'LISTO_ENTREGA';
}

export const WORK_ORDER_STATUS_ORDER = [
  'RECIBIDO',
  'ASIGNADA',
  'EN_REPARACION',
  'ESPERANDO_REPUESTO',
  'FINALIZADO',
  'LISTO_ENTREGA',
] as const;

export const WORK_ORDER_STATUS_LABELS: Record<string, string> = {
  RECIBIDO: 'Recibido',
  ASIGNADA: 'Asignada',
  EN_REPARACION: 'En reparación',
  ESPERANDO_REPUESTO: 'Esperando repuesto',
  FINALIZADO: 'Finalizado',
  LISTO_ENTREGA: 'Listo para entrega',
};

export const FINALIZED_STATUSES = ['FINALIZADO', 'LISTO_ENTREGA'] as const;

export function isFinished(status: string): boolean {
  return (FINALIZED_STATUSES as readonly string[]).includes(status);
}
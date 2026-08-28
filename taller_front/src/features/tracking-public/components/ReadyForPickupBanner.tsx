export interface ReadyForPickupBannerProps {
  status: string;
}

export function ReadyForPickupBanner({ status }: ReadyForPickupBannerProps) {
  if (status !== 'FINALIZADO' && status !== 'LISTO_ENTREGA') {
    return null;
  }

  return (
    <div className="ready-banner" role="status">
      <strong>Tu vehículo está listo para ser retirado.</strong> Acércate al taller en el
      horario de atención con tu documento de identidad.
    </div>
  );
}
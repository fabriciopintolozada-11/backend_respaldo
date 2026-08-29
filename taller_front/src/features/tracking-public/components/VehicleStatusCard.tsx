import type { VehicleStatusResponse } from '../api/vehicle-status-api';
import { ReadyForPickupBanner } from './ReadyForPickupBanner';
import { StageBadge } from './StageBadge';
import { StatusTimeline } from './StatusTimeline';

export interface VehicleStatusCardProps {
  status: VehicleStatusResponse;
}

export function VehicleStatusCard({ status }: VehicleStatusCardProps) {
  return (
    <article className="vehicle-status-card" aria-label="Estado de la orden de trabajo">
      <header>
        <h2>
          Vehículo <span className="mono">{status.plate}</span>
        </h2>
        <StageBadge status={status.status} stage={status.stage} />
      </header>

      <ReadyForPickupBanner status={status.status} />

      <dl>
        <div>
          <dt>Vehículo</dt>
          <dd>
            {status.vehicle.brand} {status.vehicle.model} · {status.vehicle.year}
          </dd>
        </div>
        <div>
          <dt>Cliente</dt>
          <dd>{status.customerName}</dd>
        </div>
        <div>
          <dt>Motivo de ingreso</dt>
          <dd>{status.initialComplaint}</dd>
        </div>
        <div>
          <dt>Ingreso</dt>
          <dd>{new Date(status.createdAt).toLocaleDateString('es-CO')}</dd>
        </div>
      </dl>

      <section aria-labelledby="current-stage-heading">
        <h3 id="current-stage-heading">Etapa actual de atención</h3>
        <p>{status.stage}</p>
      </section>

      <StatusTimeline status={status.status} />
    </article>
  );
}
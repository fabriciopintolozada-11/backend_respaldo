import { useState } from 'react';

import { ApiError } from '../../../shared/api/http-client';
import type { TrackingStatusFormValues } from '../tracking-status-schema';
import { useVehicleStatus } from '../hooks/useVehicleStatus';
import { ErrorBanner } from '../components/ErrorBanner';
import { NotFoundCard } from '../components/NotFoundCard';
import { VehicleStatusCard } from '../components/VehicleStatusCard';
import { VehicleStatusForm } from '../components/VehicleStatusForm';

export function TrackingPublicPage() {
  const [submitted, setSubmitted] = useState<{ plate: string; identification: string } | null>(
    null,
  );

  const query = useVehicleStatus({
    plate: submitted?.plate ?? '',
    identification: submitted?.identification ?? '',
    enabled: submitted !== null,
  });

  const isRequesting = submitted !== null && (query.isPending || query.isFetching);

  function handleSubmit(values: TrackingStatusFormValues) {
    setSubmitted({ plate: values.plate, identification: values.identification });
  }

  return (
    <main className="tracking-public">
      <section className="tracking-header">
        <h1>Consulta el estado de tu vehículo</h1>
        <p>
          Ingresa la placa del vehículo y tu documento de identidad para conocer el avance de la
          orden de trabajo en nuestro taller.
        </p>
      </section>

      <VehicleStatusForm disabled={isRequesting} onValid={handleSubmit} />

      {submitted === null && (
        <div className="notice-card">
          <h2>¿Cómo funciona?</h2>
          <p>
            Los datos se consultan de forma segura contra la orden de trabajo vigente. La
            información se actualiza automáticamente mientras estés en esta página.
          </p>
        </div>
      )}

      {submitted !== null && query.isPending && (
        <div className="loading" role="status">
          <span className="spinner" aria-hidden="true" />
          <span>Cargando…</span>
        </div>
      )}

      {submitted !== null && query.isError && query.error instanceof ApiError && query.error.isNotFound && (
        <NotFoundCard />
      )}

      {submitted !== null && query.isError && !(query.error instanceof ApiError && query.error.isNotFound) && (
        <ErrorBanner
          message={query.error?.message ?? 'Ocurrió un error inesperado.'}
          onRetry={() => void query.refetch()}
        />
      )}

      {submitted !== null && query.isSuccess && query.data && <VehicleStatusCard status={query.data} />}
    </main>
  );
}
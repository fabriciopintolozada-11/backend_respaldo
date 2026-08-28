import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import {
  trackingStatusSchema,
  type TrackingStatusFormValues,
} from '../tracking-status-schema';

export interface VehicleStatusFormProps {
  disabled?: boolean;
  onValid: (values: TrackingStatusFormValues) => void;
}

export function VehicleStatusForm({ disabled, onValid }: VehicleStatusFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TrackingStatusFormValues>({
    resolver: zodResolver(trackingStatusSchema),
    mode: 'onSubmit',
  });

  return (
    <form onSubmit={handleSubmit(onValid)} noValidate>
      <div>
        <label htmlFor="tracking-plate">Placa del vehículo</label>
        <input
          id="tracking-plate"
          type="text"
          autoComplete="off"
          inputMode="text"
          placeholder="Ej.: ABC123"
          disabled={disabled}
          aria-invalid={errors.plate ? 'true' : undefined}
          {...register('plate', {
            onChange: (event) => {
              event.target.value = event.target.value.toUpperCase();
            },
          })}
        />
        {errors.plate && <p role="alert">{errors.plate.message}</p>}
      </div>

      <div>
        <label htmlFor="tracking-identification">Documento de identidad</label>
        <input
          id="tracking-identification"
          type="text"
          autoComplete="off"
          disabled={disabled}
          aria-invalid={errors.identification ? 'true' : undefined}
          {...register('identification')}
        />
        {errors.identification && <p role="alert">{errors.identification.message}</p>}
      </div>

      <button type="submit" disabled={disabled || isSubmitting}>
        {isSubmitting ? 'Consultando…' : 'Consultar estado'}
      </button>
    </form>
  );
}
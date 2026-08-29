import { z } from 'zod';

const PLATE_PATTERN = /^[A-Z0-9-]{3,10}$/i;

export const trackingStatusSchema = z.object({
  plate: z
    .string()
    .trim()
    .min(1, 'Ingresa la placa del vehículo')
    .regex(PLATE_PATTERN, 'La placa debe tener entre 3 y 10 caracteres alfanuméricos'),
  identification: z.string().trim().min(1, 'Ingresa el documento de identidad'),
});

export type TrackingStatusFormValues = z.infer<typeof trackingStatusSchema>;
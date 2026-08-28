import type { RegisterVehicleEntryRequest, VehicleEntryFormValues } from './reception.types'

export const PLATE_PATTERN = /^[A-Z0-9-]{3,10}$/i

export function normalizePlate(value: string) {
  return value.trim().toUpperCase()
}

export function toRegisterRequest(values: VehicleEntryFormValues): RegisterVehicleEntryRequest {
  const phone = values.customerPhone.trim()

  return {
    plate: normalizePlate(values.plate),
    customer: {
      identification: values.customerIdentification.trim(),
      name: values.customerName.trim(),
      ...(phone ? { phone } : {}),
    },
    vehicle: {
      brand: values.brand.trim(),
      model: values.model.trim(),
      year: Number(values.year),
      isFullyElectric: values.isFullyElectric,
    },
    initialComplaint: values.initialComplaint.trim(),
  }
}

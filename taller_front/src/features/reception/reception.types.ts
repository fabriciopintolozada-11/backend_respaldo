export type TechnicalHistoryItem = {
  id: string
  description: string
  createdAt: string
}

export type VehicleHistoryResponse = {
  id: string
  plate: string
  brand: string
  model: string
  year: number
  is_fully_electric: boolean
  customer_id: string
  customer_identification: string
  customer_name: string
  customer_phone?: string
  history: TechnicalHistoryItem[]
}

export type RegisterVehicleEntryRequest = {
  plate: string
  customer: {
    identification: string
    name: string
    phone?: string
  }
  vehicle: {
    brand: string
    model: string
    year: number
    isFullyElectric: boolean
  }
  initialComplaint: string
}

export type CreatedWorkOrderResponse = {
  id: string
  vehicle_id: string
  customer_id: string
  status: string
  initial_complaint: string
  created_at: string
}

export type VehicleEntryFormValues = {
  plate: string
  customerIdentification: string
  customerName: string
  customerPhone: string
  brand: string
  model: string
  year: string
  isFullyElectric: boolean
  initialComplaint: string
}

export type LookupState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'new' }
  | { status: 'found'; data: VehicleHistoryResponse }
  | { status: 'error'; message: string }

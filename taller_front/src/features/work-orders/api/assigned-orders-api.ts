import { httpClient } from '@/shared/api/http-client'

export interface AssignedWorkOrderSummary {
  id: string
  vehicleId: string
  plate: string
  status: string
  initialComplaint: string
  assignedAt: string | null
}

export interface AssignedWorkOrderDetail {
  id: string
  vehicleId: string
  plate: string
  status: string
  initialComplaint: string
  assignedAt: string | null
  vehicle: {
    brand: string
    model: string
    year: number
  }
  tasks: WorkOrderTask[]
  parts: WorkOrderPart[]
  diagnosticReport: string | null
  statusHistory: StatusHistoryEntry[]
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}

export interface WorkOrderTask {
  id: string
  description: string
  estimatedHours: number
  isCompleted: boolean
}

export interface WorkOrderPart {
  id: string
  partCode: string
  description: string
  quantityRequired: number
  quantityUsed: number
  status: 'PENDIENTE' | 'RESERVADO' | 'INSTALADO' | 'EN_ESPERA_IMPORTACION'
}

export interface StatusHistoryEntry {
  status: string
  timestamp: string
  changedBy: string
  reason?: string
}

const assignedOrdersPath = '/work-orders/assigned'

export const assignedOrdersApi = {
  async getAssigned(page = 1, pageSize = 20): Promise<PaginatedResponse<AssignedWorkOrderSummary>> {
    const { data } = await httpClient.get<PaginatedResponse<AssignedWorkOrderSummary>>(
      assignedOrdersPath,
      { params: { page, pageSize } },
    )
    return data
  },

  async getAssignedDetail(id: string): Promise<AssignedWorkOrderDetail> {
    const { data } = await httpClient.get<AssignedWorkOrderDetail>(`${assignedOrdersPath}/${id}`)
    return data
  },
}

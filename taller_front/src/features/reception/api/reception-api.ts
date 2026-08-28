import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, httpClient } from '../../../shared/api/http-client'
import type {
  CreatedWorkOrderResponse,
  RegisterVehicleEntryRequest,
  VehicleHistoryResponse,
} from '../reception.types'
import { normalizePlate } from '../reception.validation'

export async function getVehicleHistory(
  plate: string,
  signal?: AbortSignal,
) {
  try {
    return await httpClient.get<VehicleHistoryResponse>(
      `/vehicles/${encodeURIComponent(normalizePlate(plate))}/history`,
      undefined,
      signal,
    )
  } catch (error) {
    if (error instanceof ApiError && error.isNotFound) return null
    throw error
  }
}

export function useVehicleHistory(plate: string) {
  const normalizedPlate = normalizePlate(plate)

  return useQuery({
    queryKey: ['vehicle-history', normalizedPlate],
    queryFn: ({ signal }) => getVehicleHistory(normalizedPlate, signal),
    enabled: normalizedPlate.length > 0,
  })
}

export async function createWorkOrder(
  request: RegisterVehicleEntryRequest,
) {
  if (request.vehicle.isFullyElectric) {
    const message = 'Los vehículos 100% eléctricos no pueden ser recibidos por el taller.'
    throw new ApiError(422, message, { statusCode: 422, message })
  }

  const response = await httpClient.request<CreatedWorkOrderResponse>({
    url: '/work-orders',
    method: 'POST',
    data: request,
  })

  return response.data
}

export function useCreateWorkOrder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createWorkOrder,
    onSuccess: (_order, request) => queryClient.invalidateQueries({
      queryKey: ['vehicle-history', normalizePlate(request.plate)],
    }),
  })
}

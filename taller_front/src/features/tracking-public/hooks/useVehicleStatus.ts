import { useQuery } from '@tanstack/react-query';

import { ApiError } from '../../../shared/api/http-client';
import { vehicleStatusApi, type VehicleStatusResponse } from '../api/vehicle-status-api';

export interface UseVehicleStatusParams {
  plate: string;
  identification: string;
  enabled: boolean;
}

export function useVehicleStatus({ plate, identification, enabled }: UseVehicleStatusParams) {
  return useQuery<VehicleStatusResponse, ApiError>({
    queryKey: ['vehicle-status', plate, identification],
    queryFn: () => vehicleStatusApi.getStatus({ plate, identification }),
    enabled,
    retry: (failureCount, error) => !error.isNotFound && failureCount < 1,
    refetchOnWindowFocus: true,
    refetchInterval: (query) => (query.state.data ? 30_000 : false),
  });
}
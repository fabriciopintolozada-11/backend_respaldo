import { httpClient } from '../../../shared/api/http-client';
import type { components } from '../../../shared/api/schema.gen';

export type VehicleStatusResponse = components['schemas']['VehicleStatusResponseDto'];

export type VehicleStatusParams = {
  plate: string;
  identification: string;
};

export const vehicleStatusApi = {
  getStatus(params: VehicleStatusParams): Promise<VehicleStatusResponse> {
    return httpClient.get<VehicleStatusResponse>('/public/vehicle-status', params);
  },
};
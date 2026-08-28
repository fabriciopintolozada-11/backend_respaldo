import { apiClient, type ApiResponse, isBackendMode } from '../../../shared/api/api-client';
import { mockDb } from '../../../shared/api/mock-db';
import type { Vehicle } from '../../../shared/types/openapi';

export const vehiclesService = {
  async getAll(): Promise<ApiResponse<Vehicle[]>> {
    return apiClient.get(() => mockDb.getVehicles());
  },

  async getByPlate(plate: string): Promise<ApiResponse<Vehicle | null>> {
    if (isBackendMode) {
      try {
        const response = await apiClient.getHttp<{
          id: string;
          plate: string;
          isFullyElectric: boolean;
          customer_name: string;
          customer_id: string;
          history: Array<{ createdAt: string }>;
        }>(`/vehicles/${encodeURIComponent(plate.trim().toUpperCase())}/history`);
        return {
          ...response,
          data: {
            id: response.data.id,
            plate: response.data.plate,
            brand: '',
            model: '',
            year: new Date().getFullYear(),
            fuelType: response.data.isFullyElectric ? 'ELECTRICO' : 'GASOLINA',
            color: '',
            mileage: 0,
            clientName: response.data.customer_name,
            clientDocument: response.data.customer_id,
            clientPhone: '',
            totalPreviousVisits: response.data.history.length,
          },
        };
      } catch {
        return { success: true, data: null, timestamp: new Date().toISOString() };
      }
    }
    return apiClient.get(() => {
      const vehicles = mockDb.getVehicles();
      const normalized = plate.trim().toUpperCase();
      const found = vehicles.find((v) => v.plate.toUpperCase() === normalized);
      return found || null;
    });
  },

  async registerOrUpdate(vehicleData: Omit<Vehicle, 'id' | 'totalPreviousVisits'>): Promise<ApiResponse<Vehicle>> {
    return apiClient.post((data) => {
      // RN-18: Bloqueo explícito de vehículos 100% eléctricos
      if (data.fuelType === 'ELECTRICO') {
        throw new Error(
          'REGLA DE NEGOCIO RN-18: Taller Los Fratelli está especializado exclusivamente en vehículos a combustión e híbridos livianos. No se permite el ingreso de vehículos 100% eléctricos por carecer de certificación y equipamiento de seguridad para alto voltaje.'
        );
      }

      const vehicles = mockDb.getVehicles();
      const normalizedPlate = data.plate.trim().toUpperCase();
      const existingIdx = vehicles.findIndex((v) => v.plate.toUpperCase() === normalizedPlate);

      if (existingIdx >= 0) {
        // RN-19, RN-20: Actualizar historial
        const existing = vehicles[existingIdx];
        const updated: Vehicle = {
          ...existing,
          ...data,
          plate: normalizedPlate,
          totalPreviousVisits: existing.totalPreviousVisits + 1,
          lastServiceDate: new Date().toISOString().split('T')[0],
        };
        vehicles[existingIdx] = updated;
        mockDb.saveVehicles(vehicles);
        return updated;
      } else {
        const newVehicle: Vehicle = {
          ...data,
          id: `VEH-${Date.now().toString().slice(-4)}`,
          plate: normalizedPlate,
          totalPreviousVisits: 1,
          lastServiceDate: new Date().toISOString().split('T')[0],
        };
        vehicles.push(newVehicle);
        mockDb.saveVehicles(vehicles);
        return newVehicle;
      }
    }, vehicleData);
  },
};

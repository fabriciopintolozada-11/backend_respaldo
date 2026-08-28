import { apiClient, type ApiResponse, isBackendMode } from '../../../shared/api/api-client';
import { mockDb } from '../../../shared/api/mock-db';
import type { Bay, BayStatus, Mechanic } from '../../../shared/types/openapi';
import type { ListResponse } from '../../../shared/api/schema.gen';

export interface WorkshopMetrics {
  totalBays: number;
  occupiedBays: number;
  waitingPartsBays: number;
  freeBays: number;
  bayOccupancyRatePercent: number;
  activeWorkOrdersCount: number;
  averageCycleTimeHours: number;
  mechanicsActive: number;
  totalMechanics: number;
}

export const baysService = {
  async getAll(): Promise<ApiResponse<Bay[]>> {
    return apiClient.get(() => mockDb.getBays());
  },

  async getMechanics(): Promise<ApiResponse<Mechanic[]>> {
    if (isBackendMode) {
      const response = await apiClient.getHttp<ListResponse<{ id: string; isActive: boolean }>>('/mechanics');
      return {
        ...response,
        data: response.data.data.map((mechanic) => ({
          id: mechanic.id,
          name: mechanic.id,
          nickname: mechanic.id,
          specialty: 'Mecánica General' as const,
          activeOtCount: 0,
          phone: '',
        })),
      };
    }
    return apiClient.get(() => mockDb.getMechanics());
  },

  async getMetrics(): Promise<ApiResponse<WorkshopMetrics>> {
    return apiClient.get(() => {
      const bays = mockDb.getBays();
      const mechanics = mockDb.getMechanics();
      const workOrders = mockDb.getWorkOrders();

      const occupiedBays = bays.filter((b) => b.status === 'OCUPADA').length;
      const waitingPartsBays = bays.filter((b) => b.status === 'ESPERA_REPUESTO').length;
      const freeBays = bays.filter((b) => b.status === 'LIBRE').length;
      const activeWorkOrdersCount = workOrders.filter(
        (o) => o.status === 'EN_PROGRESO' || o.status === 'EN_ESPERA_REPUESTO' || o.status === 'APROBADA'
      ).length;

      const rate = Math.round(((occupiedBays + waitingPartsBays) / 4) * 100);

      return {
        totalBays: 4,
        occupiedBays,
        waitingPartsBays,
        freeBays,
        bayOccupancyRatePercent: rate,
        activeWorkOrdersCount,
        averageCycleTimeHours: 4.8,
        mechanicsActive: 3,
        totalMechanics: mechanics.length,
      };
    });
  },

  async updateBayStatus(bayId: number, status: BayStatus, notes?: string): Promise<ApiResponse<Bay>> {
    return apiClient.post((_) => {
      const bays = mockDb.getBays();
      const idx = bays.findIndex((b) => b.id === bayId);
      if (idx === -1) throw new Error('Bahía no encontrada');

      const updated: Bay = {
        ...bays[idx],
        status,
        notes: notes ?? bays[idx].notes,
      };

      if (status === 'LIBRE') {
        updated.currentWorkOrderId = undefined;
        updated.currentVehiclePlate = undefined;
        updated.currentVehicleModel = undefined;
      }

      bays[idx] = updated;
      mockDb.saveBays(bays);
      return updated;
    }, {});
  },
};

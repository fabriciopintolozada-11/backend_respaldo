import { Injectable } from '@nestjs/common';
import { RegisterVehicleEntryDto } from './dto/register-vehicle-entry.dto';
import { VehicleHistoryResponseDto } from './dto/vehicle-history.response.dto';
import { WorkOrderRepository } from './repositories/work-order.repository';
import { normalizePlate, validateVehicleCanBeReceived } from '../../domain/work-orders/vehicle-entry.rules';

@Injectable()
export class WorkOrdersService {
  constructor(private readonly repository: WorkOrderRepository) {}

  async getVehicleHistory(plate: string): Promise<VehicleHistoryResponseDto> {
    const vehicle = await this.repository.findVehicleHistory(normalizePlate(plate));
    return {
      plate: vehicle.plate,
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.year,
      technicalHistory: vehicle.technicalHistory.map((entry) => ({ description: entry.description, createdAt: entry.createdAt })),
      workOrders: vehicle.workOrders.map((order) => ({ id: order.id, status: order.status, createdAt: order.createdAt, updatedAt: order.updatedAt })),
    };
  }

  registerVehicleEntry(dto: RegisterVehicleEntryDto, receptionistId: string) {
    validateVehicleCanBeReceived(dto.vehicle.isFullyElectric);
    return this.repository.createVehicleEntry({ ...dto, plate: normalizePlate(dto.plate) }, receptionistId);
  }
}

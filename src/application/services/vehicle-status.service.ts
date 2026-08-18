import { Injectable } from '@nestjs/common';
import { VehicleStatusRepository } from '../../infraestructure/repositories/vehicle-status.repository';
import { normalizePlate } from '../../domain/work-orders/vehicle-entry.rules';
import { getWorkOrderStage, isVehicleReadyForPickup } from '../../domain/work-orders/vehicle-status.rules';

@Injectable()
export class QueryVehicleStatusService {
  constructor(private readonly repository: VehicleStatusRepository) {}

  async getStatus(plate: string, identification: string) {
    const order = await this.repository.findLatestByPlateAndIdentification(normalizePlate(plate), identification);
    return {
      workOrderId: order.id,
      plate: order.plate,
      vehicle: { brand: order.brand, model: order.model, year: order.year },
      customerName: order.name,
      initialComplaint: order.initialComplaint,
      createdAt: order.createdAt,
      status: order.status,
      stage: getWorkOrderStage(order.status),
      readyForPickup: isVehicleReadyForPickup(order.status),
    };
  }
}

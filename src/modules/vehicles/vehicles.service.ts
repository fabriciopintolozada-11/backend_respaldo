import { Injectable, NotFoundException } from '@nestjs/common';
import { normalizePlate } from '../../domain/work-orders/vehicle-entry.rules';
import { VehicleRepository } from './repositories/vehicle.repository';
import type { VehicleHistoryRow } from './repositories/vehicle.repository';
import { VehicleHistoryConsumedPartDto, VehicleHistoryResponseDto } from './dto/vehicle-history.response.dto';

// BE-T05.3: aggregates kardex OUT movements per installed spare part, keeping
// the earliest (immutable) consumption date.
function aggregateConsumedParts(
  movements: VehicleHistoryRow['workOrders'][number]['stockMovements'],
): VehicleHistoryConsumedPartDto[] {
  const byPart = new Map<string, VehicleHistoryConsumedPartDto>();
  for (const movement of movements) {
    const current = byPart.get(movement.sparePart.id);
    byPart.set(movement.sparePart.id, {
      sparePartId: movement.sparePart.id,
      code: movement.sparePart.code,
      name: movement.sparePart.name,
      quantity: (current?.quantity ?? 0) + movement.quantity,
      createdAt: current?.createdAt ?? movement.createdAt,
    });
  }
  return [...byPart.values()];
}

@Injectable()
export class VehiclesService {
  constructor(private readonly repository: VehicleRepository) {}

  // US-05 / BE-T05.3: vehicle file with the previous delivered work orders
  // (diagnosis + installed parts) and the immutable technical history (RN-19).
  async getVehicleHistory(plate: string): Promise<VehicleHistoryResponseDto> {
    const vehicle = await this.repository.findVehicleHistory(normalizePlate(plate));
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    return {
      id: vehicle.id,
      plate: vehicle.plate,
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.year,
      isFullyElectric: vehicle.isFullyElectric,
      customerId: vehicle.customerId,
      customer: vehicle.customer,
      technicalHistory: vehicle.technicalHistory,
      workOrders: vehicle.workOrders.map((order) => ({
        id: order.id,
        status: order.status,
        createdAt: order.createdAt,
        diagnostic: order.diagnostic
          ? {
              id: order.diagnostic.id,
              description: order.diagnostic.description,
              suggestedTasks: Array.isArray(order.diagnostic.suggestedTasks)
                ? (order.diagnostic.suggestedTasks as string[])
                : [],
              estimatedHours: Number(order.diagnostic.estimatedHours),
              createdAt: order.diagnostic.createdAt,
            }
          : null,
        consumedParts: aggregateConsumedParts(order.stockMovements),
      })),
    };
  }
}
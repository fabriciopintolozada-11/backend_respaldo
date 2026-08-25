import { Injectable, NotFoundException } from '@nestjs/common';
import { VehicleStatusRepository } from './repositories/vehicle-status.repository';
import { VehicleStatusResponseDto } from './dto/vehicle-status.response.dto';

const WORK_ORDER_STAGES: Record<string, string> = {
  RECIBIDO: 'Recibido',
  EN_REPARACION: 'En reparación',
  ESPERANDO_REPUESTO: 'Esperando repuesto',
  FINALIZADO: 'Finalizado',
  LISTO_ENTREGA: 'Listo para entrega',
};

// RN-17: the public lookup must never reveal whether the failure comes from the
// plate, the identification or another customer's work order.
const WORK_ORDER_NOT_FOUND_MESSAGE = 'No valid work order found for the provided data';

@Injectable()
export class VehicleStatusService {
  constructor(private readonly repository: VehicleStatusRepository) {}

  async getStatus(plate: string, identification: string): Promise<VehicleStatusResponseDto> {
    const order = await this.repository.findLatestByPlateAndIdentification(
      this.normalizePlate(plate),
      identification.trim(),
    );

    if (!order) {
      throw new NotFoundException(WORK_ORDER_NOT_FOUND_MESSAGE);
    }

    const status = order.status;
    return {
      workOrderId: order.id,
      plate: order.vehicle.plate,
      vehicle: {
        brand: order.vehicle.brand,
        model: order.vehicle.model,
        year: order.vehicle.year,
      },
      createdAt: order.createdAt,
      status,
      stage: this.getWorkOrderStage(status),
      readyForPickup: this.isVehicleReadyForPickup(status),
    };
  }

  private normalizePlate(plate: string): string {
    return plate.trim().toUpperCase();
  }

  private getWorkOrderStage(status: string): string {
    return WORK_ORDER_STAGES[status] ?? status;
  }

  private isVehicleReadyForPickup(status: string): boolean {
    return status === 'FINALIZADO' || status === 'LISTO_ENTREGA';
  }
}

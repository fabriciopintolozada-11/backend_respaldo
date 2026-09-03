import { Injectable, NotFoundException } from '@nestjs/common';
import { VehicleStatusRepository } from './repositories/vehicle-status.repository';
import { PublicVehicleStatusResponseDto } from './dto/vehicle-status.response.dto';

const WORK_ORDER_STAGES: Record<string, string> = {
  RECIBIDO: 'Recibido',
  ASIGNADA: 'Asignado',
  EN_DIAGNOSTICO: 'En diagnóstico',
  PRESUPUESTO_ENVIADO: 'Presupuesto enviado',
  APROBADO: 'Aprobado',
  EN_REPARACION: 'En reparación',
  ESPERANDO_REPUESTO: 'Esperando repuesto',
  FINALIZADO: 'Finalizado',
  LISTO_ENTREGA: 'Listo para entrega',
  ENTREGADO: 'Entregado',
  RECHAZADO: 'Rechazado',
};

// RN-17: the public lookup must never reveal whether the failure comes from the
// plate, the identification or another customer's work order.
const WORK_ORDER_NOT_FOUND_MESSAGE = 'No valid work order found for the provided data';

// BE-02.2 (US-02 / RN-17): only these operational states are visible through the
// public lookup. Terminal / inactive states (RECHAZADO, CANCELADA, CERRADA,
// ENTREGADO) resolve to a 404 so no data leaks. Enforced at the repository via
// its own ACTIVE_WORK_ORDER_STATES constant.

@Injectable()
export class VehicleStatusService {
  constructor(private readonly repository: VehicleStatusRepository) {}

  async getStatus(plate: string, identification: string): Promise<PublicVehicleStatusResponseDto> {
    const order = await this.repository.findLatestByPlateAndIdentification(
      this.normalizePlate(plate),
      identification.trim(),
    );

    if (!order) {
      throw new NotFoundException(WORK_ORDER_NOT_FOUND_MESSAGE);
    }

    const status = order.status;
    const readyForPickup = this.isVehicleReadyForPickup(status);
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
      readyForPickup,
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

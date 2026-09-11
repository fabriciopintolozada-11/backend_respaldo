import { Injectable, NotFoundException } from '@nestjs/common';
import { PublicTrackingRequestDto } from './dto/public-tracking-request.dto';
import { PublicTrackingResponseDto } from './dto/public-tracking-response.dto';
import { PublicTrackingRepository } from './repositories/public-tracking.repository';

export const PUBLIC_TRACKING_NOT_FOUND_MESSAGE =
  'No se encontró ninguna orden de trabajo activa asociada a los datos ingresados';

@Injectable()
export class PublicTrackingService {
  constructor(private readonly repository: PublicTrackingRepository) {}

  async findActiveWorkOrder(dto: PublicTrackingRequestDto): Promise<PublicTrackingResponseDto> {
    const order = await this.repository.findActiveByPlateAndNationalId(
      this.normalizeLicensePlate(dto.licensePlate),
      dto.nationalId.trim(),
    );

    // RN-17: do not reveal whether the plate exists, the CI is wrong or the
    // order is no longer active.
    if (!order) {
      throw new NotFoundException(PUBLIC_TRACKING_NOT_FOUND_MESSAGE);
    }

    return {
      workOrderNumber: order.id,
      vehicleModel: order.vehicle.model,
      status: order.status,
      receivedAt: order.createdAt,
      readyForPickup: this.isReadyForPickup(order.status),
      tasksSummary: order.quote?.details.map((detail) => detail.description) ?? [],
    };
  }

  private normalizeLicensePlate(licensePlate: string): string {
    return licensePlate.trim().toUpperCase();
  }

  private isReadyForPickup(status: string): boolean {
    return status === 'LISTO_ENTREGA' || status === 'FINALIZADO';
  }
}

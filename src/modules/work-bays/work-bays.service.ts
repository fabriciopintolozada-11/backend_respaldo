import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { WorkBayRepository } from './repositories/work-bay.repository';
import { AssignWorkBayDto, AssignWorkBayResponseDto } from './dto/assign-work-bay.dto';
import { UpdateWorkBayStatusDto } from './dto/update-work-bay-status.dto';
import { WorkBayMonitoringResponseDto } from './dto/work-bay-response.dto';
import { WorkOrderStatus } from '../../common/enums/work-order-status.enum';
import { BayStatus } from '../../common/enums/work-bay-status.enum';

// US-18 (BE-06, BE-07): orchestrates physical bay business rules (RN-05,
// RN-14). The service is HTTP-agnostic and only throws domain exceptions.
@Injectable()
export class WorkBaysService {
  constructor(private readonly repository: WorkBayRepository) {}

  async getMonitoring(): Promise<WorkBayMonitoringResponseDto[]> {
    const rows = await this.repository.findAllByNumber();
    const now = Date.now();

    return rows.map((row) => {
      const workOrder = row.currentWorkOrder;
      const status = !row.isOccupied
        ? BayStatus.FREE
        : workOrder && workOrder.status === WorkOrderStatus.WAITING_FOR_PART
          ? BayStatus.WAITING_FOR_PART
          : BayStatus.OCCUPIED;

      return {
        id: row.id,
        bayNumber: row.bayNumber,
        isOccupied: row.isOccupied,
        status,
        currentWorkOrderId: row.currentWorkOrderId,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        currentWorkOrder: workOrder
          ? {
              id: workOrder.id,
              status: workOrder.status,
              plate: workOrder.vehicle?.plate ?? null,
              vehicleBrand: workOrder.vehicle?.brand ?? null,
              vehicleModel: workOrder.vehicle?.model ?? null,
              mechanicId: workOrder.mechanic?.id ?? null,
              mechanicName: row.mechanicName,
              assignedAt: workOrder.assignedAt,
              elapsedHours: computeElapsedHours(workOrder.assignedAt ?? row.updatedAt, now),
            }
          : null,
      };
    });
  }

  async assign(bayId: string, dto: AssignWorkBayDto): Promise<AssignWorkBayResponseDto> {
    try {
      return await this.repository.assignWorkOrder(bayId, dto.workOrderId);
    } catch (error) {
      // 404 and 409 carry their own semantic HTTP status (BE-23).
      if (error instanceof NotFoundException) throw error;
      if (error instanceof ConflictException) throw error;
      throw new UnprocessableEntityException((error as Error).message);
    }
  }

  async setStatus(bayId: string, dto: UpdateWorkBayStatusDto): Promise<AssignWorkBayResponseDto> {
    try {
      return await this.repository.setOccupied(bayId, dto.isOccupied);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new UnprocessableEntityException((error as Error).message);
    }
  }
}

function computeElapsedHours(since: Date, now: number): number {
  const diffMs = Math.max(0, now - since.getTime());
  return Number((diffMs / 3_600_000).toFixed(2));
}
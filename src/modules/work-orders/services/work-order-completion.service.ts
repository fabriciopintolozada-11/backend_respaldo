import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { WorkOrderRepository } from '../repositories/work-order.repository';
import { CompleteWorkOrderDto } from '../dto/complete-work-order.dto';
import { CompleteWorkOrderResponseDto } from '../dto/complete-work-order.response.dto';
import { UserRole } from '../../../common/enums/user-role.enum';
import { WorkOrderStatus } from '../../../common/enums/work-order-status.enum';

@Injectable()
export class WorkOrderCompletionService {
  constructor(private readonly repository: WorkOrderRepository) {}

  // US-19: conclude a repair, set the work order to READY_FOR_DELIVERY and free
  // its physical bay (BE-T19.2, RN-05, RN-14, RN-19). All rules live here
  // (BE-06); the repository performs the atomic persistence (BE-16).
  async complete(
    workOrderId: string,
    userId: string,
    role: string,
    dto: CompleteWorkOrderDto,
  ): Promise<CompleteWorkOrderResponseDto> {
    const context = await this.repository.findCompleteContext(workOrderId);
    if (!context) throw new NotFoundException('Work order not found');

    // RN-04: the mechanic can only conclude work orders assigned to him; the
    // workshop lead supervises and is always allowed. BE-E12: RN-04 violations
    // are consistently reported as 422 across consume-part, awaiting-part and
    // complete (the role guard itself still returns 403 via @Roles).
    if (role === UserRole.MECHANIC && context.mechanicId !== userId) {
      throw new UnprocessableEntityException('RN-04: work order is not assigned to this mechanic');
    }

    // RN-05: a work order waiting for spare parts must not be concluded.
    if (context.status === WorkOrderStatus.WAITING_FOR_PART) {
      throw new UnprocessableEntityException(
        'RN-05: work order is awaiting spare parts and cannot be concluded',
      );
    }

    // State machine (E4): only IN_REPAIR can be concluded.
    if (context.status !== WorkOrderStatus.IN_REPAIR) {
      throw new ConflictException(
        'Work order must be in IN_REPAIR to conclude the repair',
      );
    }

    return this.repository.completeWorkOrder(workOrderId, dto, userId);
  }
}
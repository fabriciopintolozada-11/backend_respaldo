import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { WorkOrderRepository } from '../repositories/work-order.repository';
import { ConsumeSparePartDto } from '../dto/consume-spare-part.dto';
import { ReturnSparePartDto } from '../dto/return-spare-part.dto';
import { WorkOrderPartResponseDto } from '../dto/work-order-part.response.dto';
import { SetAwaitingPartDto } from '../dto/set-awaiting-part.dto';
import { AwaitingPartResponseDto } from '../dto/awaiting-part-response.dto';
import { UserRole } from '../../../common/enums/user-role.enum';
import { WorkOrderStatus } from '../../../common/enums/work-order-status.enum';

@Injectable()
export class PartReservationService {
  constructor(private readonly repository: WorkOrderRepository) {}

  // HU-07: confirm the installation/use of a reserved spare part.
  // All rules live in the service (BE-06); the repository performs the atomic
  // persistence (BE-16).
  async consumePart(
    workOrderId: string,
    userId: string,
    role: string,
    dto: ConsumeSparePartDto,
  ): Promise<WorkOrderPartResponseDto> {
    const context = await this.repository.findConsumeContext(workOrderId);
    if (!context) throw new NotFoundException('Work order not found');

    // RN-04: only the assigned mechanic consumes parts; the workshop lead
    // oversees and is always allowed.
    if (role === UserRole.MECHANIC && context.mechanicId !== userId) {
      throw new UnprocessableEntityException('RN-04: work order is not assigned to this mechanic');
    }

    // RN-09: the order must be approved or in repair. Receiving/diagnostic
    // stages cannot start a repair or consume stock.
    if (![WorkOrderStatus.APPROVED, WorkOrderStatus.IN_REPAIR].includes(context.status as WorkOrderStatus)) {
      throw new UnprocessableEntityException('RN-09: work order is not approved or in repair to consume a spare part');
    }

    // RN-07: the requested part must belong to this order's approved quote and
    // be reserved exclusively for it.
    const partId = dto.workOrderPartId ?? dto.quotePartId;
    const part = context.quote?.parts?.find((item) => item.id === partId);
    if (!part || part.status !== 'RESERVED') {
      throw new UnprocessableEntityException('RN-07: spare part is not reserved for this work order');
    }

    // RN-01: never consume more than the reserved quantity.
    // HU-07: the first consumption of an approved order moves it to repair.
    const nextStatus = context.status === WorkOrderStatus.APPROVED ? WorkOrderStatus.IN_REPAIR : context.status;

    return this.repository.consumePart(workOrderId, dto, userId, nextStatus);
  }

  // HU-07 / BE-E03: physically return a spare part that was already consumed
  // in a work order, restoring the discounted stock. All rules live in the
  // service (BE-06); the repository performs the atomic persistence (BE-16).
  async returnPart(
    workOrderId: string,
    userId: string,
    role: string,
    dto: ReturnSparePartDto,
  ): Promise<WorkOrderPartResponseDto> {
    const context = await this.repository.findConsumeContext(workOrderId);
    if (!context) throw new NotFoundException('Work order not found');

    // RN-04: only the assigned mechanic returns parts; the workshop lead
    // oversees and is always allowed.
    if (role === UserRole.MECHANIC && context.mechanicId !== userId) {
      throw new UnprocessableEntityException('RN-04: work order is not assigned to this mechanic');
    }

    // BE-E03: a part can only be physically returned while the order is still
    // being worked on. Delivered/settled orders keep their charged parts.
    if (![WorkOrderStatus.IN_REPAIR, WorkOrderStatus.WAITING_FOR_PART].includes(context.status as WorkOrderStatus)) {
      throw new ConflictException(
        'Work order must be in IN_REPAIR to return a spare part',
      );
    }

    // RN-07: the returned part must belong to this order's quote.
    const part = context.quote?.parts?.find((item) => item.sparePartId === dto.sparePartId);
    if (!part) {
      throw new UnprocessableEntityException(
        'RN-07: spare part is not associated with this work order',
      );
    }

    return this.repository.returnPart(workOrderId, dto, userId);
  }

  // US-13: set a work order to WAITING_FOR_PART when a spare part is
  // physically unavailable in the warehouse. All business rules live here
  // (BE-06); the repository performs the atomic persistence (BE-16).
  async setAwaitingPart(
    workOrderId: string,
    userId: string,
    role: string,
    dto: SetAwaitingPartDto,
  ): Promise<AwaitingPartResponseDto> {
    const context = await this.repository.findAwaitingPartContext(workOrderId);
    if (!context) throw new NotFoundException('Work order not found');

    // RN-04: only the assigned mechanic can set the order to awaiting part;
    // the workshop lead oversees and is always allowed.
    if (role === UserRole.MECHANIC && context.mechanicId !== userId) {
      throw new UnprocessableEntityException('RN-04: work order is not assigned to this mechanic');
    }

    // RN-05: the work order must be strictly in IN_REPAIR to transition
    // to WAITING_FOR_PART.
    if (context.status !== WorkOrderStatus.IN_REPAIR) {
      throw new ConflictException(
        'RN-05: work order must be in IN_REPAIR to set awaiting part',
      );
    }

    // Validate that the missing part belongs to this work order's approved
    // quote. This prevents reporting a part that was never requested.
    const quoteParts = context.quote?.parts ?? [];
    const partBelongsToOrder = quoteParts.some(
      (p) => p.sparePartId === dto.missingPartId,
    );
    if (!partBelongsToOrder) {
      throw new UnprocessableEntityException(
        'The reported spare part is not associated with this work order',
      );
    }

    return this.repository.setAwaitingPart(
      workOrderId,
      dto,
      userId,
      context.vehicleId,
    );
  }
}
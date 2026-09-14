import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CompleteWorkOrderDto } from '../dto/complete-work-order.dto';
import { CompleteWorkOrderResponseDto } from '../dto/complete-work-order.response.dto';
import { WorkOrderStatus } from '../../../common/enums/work-order-status.enum';

@Injectable()
export class WorkOrderCompletionRepository {
  constructor(private readonly prisma: PrismaService) {}

  // US-19: read the context needed to conclude a repair: status, assigned
  // mechanic, vehicle and receptionist. No financial fields (RN-16).
  findCompleteContext(workOrderId: string) {
    return this.prisma.workOrder.findUnique({
      where: { id: workOrderId },
      select: {
        id: true,
        status: true,
        mechanicId: true,
        vehicleId: true,
        receptionistId: true,
      },
    });
  }

  // US-19 / BE-16 / RN-05 / RN-14 / RN-19: atomically conclude a repair. Sets
  // the work order to READY_FOR_DELIVERY, frees its physical bay, persists the
  // immutable technical history entry and notifies reception (single
  // Prisma transaction, BE-16).
  completeWorkOrder(
    workOrderId: string,
    dto: CompleteWorkOrderDto,
    userId: string,
  ): Promise<CompleteWorkOrderResponseDto> {
    return this.prisma.$transaction(async (transaction) => {
      const order = await transaction.workOrder.findUnique({
        where: { id: workOrderId },
        select: { id: true, vehicleId: true, receptionistId: true },
      });
      if (!order) throw new NotFoundException('Work order not found');

      // RN-05 / RN-14: release the physical bay bound to this work order.
      const bay = await transaction.workBay.findFirst({
        where: { currentWorkOrderId: workOrderId },
        select: { id: true, bayNumber: true },
      });
      if (bay) {
        await transaction.workBay.update({
          where: { id: bay.id },
          data: { isOccupied: false, currentWorkOrderId: null },
        });
      }

      const completedAt = new Date();
      await transaction.workOrder.update({
        where: { id: workOrderId },
        data: { status: WorkOrderStatus.READY_FOR_DELIVERY },
      });

      // RN-19: permanent, immutable technical history entry with the user who
      // concluded the work and the closing data entered by the mechanic.
      const mileageNote = dto.finalMileage !== undefined ? `, final mileage: ${dto.finalMileage} km` : '';
      const notes = dto.closingNotes ? `, closing notes: ${dto.closingNotes}` : '';
      await transaction.technicalHistory.create({
        data: {
          vehicleId: order.vehicleId,
          description:
            `Work order ${workOrderId} concluded and ready for pickup. Completed by user ${userId}.` +
            `${mileageNote}${notes}`,
        },
      });

      // US-19 gherkin: reception gets an indicator that the vehicle is ready.
      await transaction.notification.create({
        data: {
          recipientId: order.receptionistId,
          workOrderId,
          type: 'WORK_ORDER_READY',
          message: `The vehicle from work order ${workOrderId} is ready for pickup`,
        },
      });

      return {
        id: workOrderId,
        status: WorkOrderStatus.READY_FOR_DELIVERY,
        completedAt,
        bayNumber: bay?.bayNumber ?? null,
        finalMileage: dto.finalMileage ?? null,
        closingNotes: dto.closingNotes ?? null,
      };
    });
  }
}
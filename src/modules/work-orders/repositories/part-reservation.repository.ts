import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ConsumeSparePartDto } from '../dto/consume-spare-part.dto';
import { ReturnSparePartDto } from '../dto/return-spare-part.dto';
import { WorkOrderPartResponseDto } from '../dto/work-order-part.response.dto';
import { SetAwaitingPartDto } from '../dto/set-awaiting-part.dto';
import { AwaitingPartResponseDto } from '../dto/awaiting-part-response.dto';
import { WorkOrderStatus } from '../../../common/enums/work-order-status.enum';

@Injectable()
export class PartReservationRepository {
  constructor(private readonly prisma: PrismaService) {}

  // HU-07: read context needed to validate a part consumption without
  // duplicating the transactional stock guard. Returns ownership, status and
  // the reserved quote part lines (never financial fields).
  findConsumeContext(workOrderId: string) {
    return this.prisma.workOrder.findUnique({
      where: { id: workOrderId },
      select: {
        id: true,
        status: true,
        mechanicId: true,
        vehicleId: true,
        quote: {
          select: {
            parts: {
              select: {
                id: true,
                sparePartId: true,
                quantity: true,
                status: true,
                sparePart: { select: { code: true, name: true } },
              },
            },
          },
        },
      },
    });
  }

  // HU-07 / BE-16 / RN-08: atomically consume a reserved spare part. The stock
  // decrement (physical + reserved), the INSTALLED status change, the work
  // order state transition and the immutable kardex record all run inside a
  // single Prisma transaction. RN-01 is enforced with an atomic guarded update
  // so the physical stock can never become negative.
  consumePart(
    workOrderId: string,
    dto: ConsumeSparePartDto,
    userId: string,
    nextStatus: string,
  ): Promise<WorkOrderPartResponseDto> {
    return this.prisma.$transaction(async (transaction) => {
      const order = await transaction.workOrder.findUnique({
        where: { id: workOrderId },
        select: {
          id: true,
          status: true,
          vehicleId: true,
          quote: {
            select: {
              parts: {
                where: { id: dto.workOrderPartId ?? dto.quotePartId },
                select: {
                  id: true,
                  sparePartId: true,
                  quantity: true,
                  status: true,
                  sparePart: { select: { code: true, name: true } },
                },
              },
            },
          },
        },
      });
      const part = order?.quote?.parts?.[0];
      if (!order || !part) throw new NotFoundException('Work order not found');
      // RN-07: the part must already be reserved for this work order.
      if (part.status !== 'RESERVED') {
        throw new UnprocessableEntityException('RN-07: spare part is not reserved for this work order');
      }
      const consumed = await transaction.stockMovement.aggregate({
        _sum: { quantity: true },
        where: { workOrderId, sparePartId: part.sparePartId, type: 'OUT' },
      });
      const consumedQuantity = consumed._sum.quantity ?? 0;
      const pendingQuantity = part.quantity - consumedQuantity;
      if (dto.quantity > pendingQuantity) {
        throw new UnprocessableEntityException('RN-01: quantity exceeds the reserved amount pending for the spare part');
      }
      // RN-08 + RN-01: guarded atomic decrement of physical and reserved stock.
      // The update only matches when both stocks are sufficient, preventing a
      // negative balance at the database level. availableStock is NOT
      // decremented here (BE-E02): the reservation already moved the units from
      // available to reserved, so the invariant available = physical - reserved
      // holds without touching it on consumption.
      const stockUpdate = await transaction.sparePart.updateMany({
        where: {
          id: part.sparePartId,
          physicalStock: { gte: dto.quantity },
          reservedStock: { gte: dto.quantity },
        },
        data: {
          physicalStock: { decrement: dto.quantity },
          reservedStock: { decrement: dto.quantity },
          lastMovementAt: new Date(),
        },
      });
      if (stockUpdate.count !== 1) {
        throw new UnprocessableEntityException('RN-01: insufficient physical stock to consume the spare part');
      }
      // Keep a partial reservation available until all reserved units are used.
      await transaction.quotePart.update({
        where: { id: part.id },
        data: { status: dto.quantity === pendingQuantity ? 'INSTALLED' : 'RESERVED' },
      });
      // HU-07: first consumption of an approved order moves it to repair.
      if (nextStatus && nextStatus !== order.status) {
        await transaction.workOrder.update({ where: { id: workOrderId }, data: { status: nextStatus } });
      }
      // BE-17: immutable kardex record (audit trail, never updated/deleted).
      // The mechanic's optional note is persisted as the movement reason.
      await transaction.stockMovement.create({
        data: {
          workOrderId,
          sparePartId: part.sparePartId,
          userId,
          quantity: dto.quantity,
          type: 'OUT',
          ...(dto.notes ? { reason: dto.notes } : {}),
        },
      });
      // RN-19: permanent technical history entry.
      await transaction.technicalHistory.create({
        data: {
          vehicleId: order.vehicleId,
          description: `Spare part consumed for work order ${workOrderId}: ${part.sparePart.code} x${dto.quantity}`,
        },
      });
      // RN-16: return only the agreed allowlist. No financial fields.
      return {
        id: part.id,
        code: part.sparePart.code,
        name: part.sparePart.name,
        quantity: dto.quantity,
         status: dto.quantity === pendingQuantity ? 'INSTALLED' : 'RESERVED',
      };
    });
  }

  // HU-07 / BE-E03 / BE-16 / RN-08 / RN-19: atomically return a spare part that
  // was already consumed (installed) in a work order. The physical and available
  // stock are restored, the kardex IN movement and the immutable technical
  // history entry are recorded, and the quote part line is released when no
  // unit of it remains installed. RN-01 is enforced against the net consumed
  // units (OUT - IN) of the part for this work order, so the returned quantity
  // can never exceed what was actually discounted and stock is never restored
  // twice.
  returnPart(
    workOrderId: string,
    dto: ReturnSparePartDto,
    userId: string,
  ): Promise<WorkOrderPartResponseDto> {
    return this.prisma.$transaction(async (transaction) => {
      const order = await transaction.workOrder.findUnique({
        where: { id: workOrderId },
        select: {
          id: true,
          status: true,
          vehicleId: true,
          quote: {
            select: {
              parts: {
                where: { sparePartId: dto.sparePartId },
                select: {
                  id: true,
                  sparePartId: true,
                  quantity: true,
                  status: true,
                  sparePart: { select: { code: true, name: true } },
                },
              },
            },
          },
        },
      });
      const part = order?.quote?.parts?.[0];
      if (!order || !part) throw new NotFoundException('Work order not found');

      // RN-01: only units that were actually discounted can be returned. The
      // net consumed amount already discounts previous returns (kardex IN).
      const movements = await transaction.stockMovement.groupBy({
        by: ['type'],
        where: { workOrderId, sparePartId: part.sparePartId },
        _sum: { quantity: true },
      });
      let netConsumed = 0;
      for (const movement of movements) {
        if (movement.type === 'OUT') netConsumed += movement._sum.quantity ?? 0;
        if (movement.type === 'IN') netConsumed -= movement._sum.quantity ?? 0;
      }
      if (netConsumed <= 0) {
        throw new UnprocessableEntityException(
          'RN-01: the spare part has not been consumed in this work order',
        );
      }
      if (dto.quantity > netConsumed) {
        throw new UnprocessableEntityException(
          'RN-01: quantity exceeds the net consumed units of the spare part for this work order',
        );
      }

      const sparePart = await transaction.sparePart.findUnique({
        where: { id: part.sparePartId },
        select: { physicalStock: true, isActive: true },
      });
      if (!sparePart || !sparePart.isActive) {
        throw new NotFoundException('Spare part not found or inactive');
      }

      // RN-08: restore the discounted physical stock. The reserved stock is
      // left untouched (the reserved units were already consumed) and the
      // available stock is increased to keep recentered on physical stock, so
      // the balance available = physical - reserved is never corrupted.
      const newPhysicalStock = sparePart.physicalStock + dto.quantity;
      await transaction.sparePart.update({
        where: { id: part.sparePartId },
        data: {
          physicalStock: { increment: dto.quantity },
          availableStock: { increment: dto.quantity },
          lastMovementAt: new Date(),
        },
      });

      // BE-17: immutable kardex record (audit trail, never updated/deleted);
      // the mechanic's optional note is persisted as the movement reason.
      await transaction.stockMovement.create({
        data: {
          workOrderId,
          sparePartId: part.sparePartId,
          userId,
          quantity: dto.quantity,
          type: 'IN',
          reason: dto.notes ?? `Spare part returned to stock for work order ${workOrderId}`,
          previousPhysicalStock: sparePart.physicalStock,
          newPhysicalStock,
        },
      });

      // The quote part line keeps being billed while it still has installed
      // units; when nothing remains installed it is fully released.
      const remainingInstalled = netConsumed - dto.quantity;
      const nextStatus = remainingInstalled <= 0 ? 'RELEASED' : 'INSTALLED';
      await transaction.quotePart.update({
        where: { id: part.id },
        data: { status: nextStatus },
      });

      // RN-19: permanent technical history entry.
      await transaction.technicalHistory.create({
        data: {
          vehicleId: order.vehicleId,
          description: `Spare part returned to stock for work order ${workOrderId}: ${part.sparePart.code} x${dto.quantity} by user ${userId}`,
        },
      });

      // RN-16: return only the agreed allowlist. No financial fields.
      return {
        id: part.id,
        code: part.sparePart.code,
        name: part.sparePart.name,
        quantity: dto.quantity,
        status: nextStatus,
      };
    });
  }

  // US-13: read context needed to validate an awaiting-part transition.
  // Returns ownership, status and the quote parts linked to this work order
  // so the service can verify the missingPartId belongs to the order.
  findAwaitingPartContext(workOrderId: string) {
    return this.prisma.workOrder.findUnique({
      where: { id: workOrderId },
      select: {
        id: true,
        status: true,
        mechanicId: true,
        vehicleId: true,
        quote: {
          select: {
            parts: {
              select: {
                id: true,
                sparePartId: true,
                quantity: true,
                status: true,
              },
            },
          },
        },
      },
    });
  }

  // US-13 / BE-16 / RN-05 / RN-19: atomically set a work order to
  // WAITING_FOR_PART. The state transition, the immutable technical
  // history entry and the inventory discrepancy record all run inside a
  // single Prisma transaction (BE-16).
  setAwaitingPart(
    workOrderId: string,
    dto: SetAwaitingPartDto,
    userId: string,
    vehicleId: string,
  ): Promise<AwaitingPartResponseDto> {
    return this.prisma.$transaction(async (transaction) => {
      // BE-17: update work order status to WAITING_FOR_PART (RN-05).
      await transaction.workOrder.update({
        where: { id: workOrderId },
        data: { status: WorkOrderStatus.WAITING_FOR_PART },
      });

      // RN-19: permanent, immutable technical history entry.
      await transaction.technicalHistory.create({
        data: {
          vehicleId,
          description:
            `Work order set to AWAITING_PART. Missing spare part id: ${dto.missingPartId}, quantity: ${dto.quantity}. Reason: ${dto.reason}`,
        },
      });

      // US-13: register an inventory discrepancy for the workshop lead to
      // audit the physical stock mismatch later.
      const discrepancy = await transaction.inventoryDiscrepancy.create({
        data: {
          workOrderId,
          sparePartId: dto.missingPartId,
          reportedBy: userId,
          quantity: dto.quantity,
          reason: dto.reason,
        },
      });

      return {
        id: workOrderId,
        status: WorkOrderStatus.WAITING_FOR_PART,
        missingPartId: dto.missingPartId,
        quantity: dto.quantity,
        reason: dto.reason,
        createdAt: discrepancy.createdAt,
      };
    });
  }
}
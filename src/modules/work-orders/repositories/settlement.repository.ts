import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma } from '../../../generated/prisma/client';
import { DeliverWorkOrderDto } from '../dto/deliver-work-order.dto';
import { DeliverWorkOrderResponseDto } from '../dto/deliver-work-order.response.dto';
import { ApplyDiscountDto } from '../dto/apply-discount.dto';
import { VoidAdjustmentDto } from '../dto/void-adjustment.dto';
import { SettlementAdjustmentResponseDto, AdjustmentType } from '../dto/settlement-adjustment.response.dto';
import { releaseReservedParts } from './reserved-parts-release';

@Injectable()
export class SettlementRepository {
  constructor(private readonly prisma: PrismaService) {}

  // US-20: read the context needed to build the consolidated settlement
  // (RN-21). Financial fields are exposed only to RECEPTIONIST/ADMIN roles
  // through the settlement DTO (BE-12, RN-21). Includes vehicle, customer,
  // the approved quote totals and the spare part lines.
  findSettlementContext(workOrderId: string) {
    return this.prisma.workOrder.findUnique({
      where: { id: workOrderId },
      select: {
        id: true,
        status: true,
        deliveredAt: true,
        vehicleId: true,
        vehicle: { select: { plate: true, brand: true, model: true, year: true } },
        customer: { select: { name: true } },
        quote: {
          select: {
            laborSubtotal: true,
            partsSubtotal: true,
            currency: true,
            parts: {
              // BE-E06 / HU-21: superseded re-quote lines never appear in the
              // settlement view.
              where: { status: { not: 'SUPERSEDED' } },
              select: {
                id: true,
                status: true,
                quantity: true,
                unitPrice: true,
                subtotal: true,
                sparePart: { select: { code: true, name: true } },
              },
            },
          },
        },
        settlementAdjustments: {
          select: {
            id: true,
            type: true,
            amount: true,
            reason: true,
            appliedBy: true,
            createdAt: true,
          },
        },
      },
    });
  }

  // US-20 / BE-16 / RN-21 / RN-19: atomically settle and deliver a vehicle.
  // The status transition to ENTREGADO, the handover timestamp, the payment
  // data, the charged total and the immutable technical history entry all run
  // inside a single Prisma transaction (BE-16).
  deliverWorkOrder(
    workOrderId: string,
    userId: string,
    dto: DeliverWorkOrderDto,
  ): Promise<DeliverWorkOrderResponseDto> {
    return this.prisma.$transaction(async (transaction) => {
      const order = await transaction.workOrder.findUnique({
        where: { id: workOrderId },
        select: {
          id: true,
          vehicleId: true,
          status: true,
          deliveredAt: true,
          quote: {
            select: {
              laborSubtotal: true,
              currency: true,
              parts: {
                where: { status: 'INSTALLED' },
                select: { subtotal: true },
              },
            },
          },
          settlementAdjustments: {
            select: { type: true, amount: true },
          },
        },
      });
      if (!order) throw new NotFoundException('Work order not found');
      // Defensive guard inside the transaction (BE-16): prevents a concurrent
      // double settlement of the same work order (RN-21).
      if (order.status !== 'LISTO_ENTREGA') {
        throw new ConflictException('Work order must be in LISTO_ENTREGA to be delivered');
      }
      if (order.deliveredAt) {
        throw new ConflictException('Work order has already been delivered');
      }

      // HU-07 / BE-E03: parts that were never consumed (still RESERVED) are
      // released back to the available stock on the same transaction, so the
      // inventory is not permanently blocked once the vehicle is delivered.
      await releaseReservedParts(transaction, workOrderId);

      // RN-21: total = approved labor subtotal + installed parts subtotal.
      const laborSubtotal = order.quote?.laborSubtotal ?? new Prisma.Decimal(0);
      const partsSubtotal = (order.quote?.parts ?? []).reduce(
        (sum, part) => sum.plus(part.subtotal),
        new Prisma.Decimal(0),
      );
      // RN-15: subtract active discounts from the total
      const adjustments = order.settlementAdjustments;
      const activeDiscounts = adjustments.reduce(
        (sum, adj) => {
          if (adj.type === 'DISCOUNT') return sum.plus(adj.amount);
          if (adj.type === 'VOID') return sum.minus(adj.amount);
          return sum;
        },
        new Prisma.Decimal(0),
      );
      const totalCharged = laborSubtotal.plus(partsSubtotal).minus(activeDiscounts);

      const deliveredAt = new Date();
      await transaction.workOrder.update({
        where: { id: workOrderId },
        data: {
          status: 'ENTREGADO',
          deliveredAt,
          paymentMethod: dto.paymentMethod,
          receiptNumber: dto.receiptNumber,
          totalCharged,
          ...(dto.deliveryNotes ? { deliveryNotes: dto.deliveryNotes } : {}),
        },
      });

      // RN-19: permanent, immutable technical history entry documenting the
      // settlement and the handover.
      const historyParts = [
        `Work order ${workOrderId} delivered. Payment: ${dto.paymentMethod}, receipt: ${dto.receiptNumber}.`,
        `Subtotal: ${order.quote?.currency ?? 'BOB'} ${laborSubtotal.plus(partsSubtotal).toFixed(2)}.`,
      ];
      if (activeDiscounts.greaterThan(0)) {
        historyParts.push(`Discounts: -${order.quote?.currency ?? 'BOB'} ${activeDiscounts.toFixed(2)}.`);
      }
      historyParts.push(`Charged: ${order.quote?.currency ?? 'BOB'} ${totalCharged.toFixed(2)}. Delivered by user ${userId}`);

      await transaction.technicalHistory.create({
        data: {
          vehicleId: order.vehicleId,
          description: historyParts.join(' '),
        },
      });

      // RN-21 / BE-13: return the agreed allowlist. The charged total is
      // serialized as a string with the DECIMAL(12,2) scale to avoid float
      // precision loss and inconsistent trailing zeros.
      return {
        id: workOrderId,
        status: 'ENTREGADO',
        deliveredAt,
        paymentMethod: dto.paymentMethod,
        receiptNumber: dto.receiptNumber,
        totalCharged: totalCharged.toFixed(2),
        deliveryNotes: dto.deliveryNotes ?? null,
      };
    });
  }

  // US-20 / RN-15 / BE-16 / BE-17: apply a discount to the settlement of a
  // work order. The discount is recorded as an immutable SettlementAdjustment
  // (insert-only, same pattern as StockMovement). A technicalHistory entry is
  // created for permanent audit trail (RN-19).
  applyDiscount(
    workOrderId: string,
    userId: string,
    dto: ApplyDiscountDto,
  ): Promise<SettlementAdjustmentResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.workOrder.findUnique({
        where: { id: workOrderId },
        select: {
          id: true,
          vehicleId: true,
          status: true,
          deliveredAt: true,
          quote: {
            select: {
              laborSubtotal: true,
              currency: true,
              parts: {
                where: { status: 'INSTALLED' },
                select: { subtotal: true },
              },
            },
          },
          settlementAdjustments: {
            select: { type: true, amount: true },
          },
        },
      });
      if (!order) throw new NotFoundException('Work order not found');
      if (order.status !== 'LISTO_ENTREGA') {
        throw new ConflictException('Work order must be in LISTO_ENTREGA to apply discounts');
      }
      if (order.deliveredAt) {
        throw new ConflictException('Work order has already been delivered');
      }

      // Calculate active discounts: sum(DISCOUNT) - sum(VOID)
      const activeDiscounts = order.settlementAdjustments.reduce(
        (sum, adj) => {
          if (adj.type === 'DISCOUNT') return sum.plus(adj.amount);
          if (adj.type === 'VOID') return sum.minus(adj.amount);
          return sum;
        },
        new Prisma.Decimal(0),
      );

      // Calculate the gross total: labor + INSTALLED parts
      const laborSubtotal = order.quote?.laborSubtotal ?? new Prisma.Decimal(0);
      const partsSubtotal = (order.quote?.parts ?? []).reduce(
        (sum, part) => sum.plus(part.subtotal),
        new Prisma.Decimal(0),
      );
      const totalBruto = laborSubtotal.plus(partsSubtotal);

      // RN-15: discount cannot exceed the available amount
      const disponible = totalBruto.minus(activeDiscounts);
      if (new Prisma.Decimal(dto.amount).greaterThan(disponible)) {
        throw new UnprocessableEntityException(
          'RN-15: discount amount exceeds the available total for this settlement',
        );
      }

      // Create the immutable DISCOUNT adjustment (insert-only, BE-17)
      const adjustment = await tx.settlementAdjustment.create({
        data: {
          workOrderId,
          type: 'DISCOUNT',
          amount: new Prisma.Decimal(dto.amount),
          reason: dto.reason,
          appliedBy: userId,
        },
      });

      // RN-19: immutable technical history entry
      await tx.technicalHistory.create({
        data: {
          vehicleId: order.vehicleId,
          description:
            `Work order ${workOrderId} settlement discount applied: ${order.quote?.currency ?? 'BOB'} ` +
            `${dto.amount.toFixed(2)}. Reason: ${dto.reason}. Applied by user ${userId}`,
        },
      });

      return {
        id: adjustment.id,
        workOrderId,
        type: AdjustmentType.DISCOUNT,
        amount: adjustment.amount.toFixed(2),
        reason: adjustment.reason,
        appliedBy: adjustment.appliedBy,
        createdAt: adjustment.createdAt,
      };
    });
  }

  // US-20 / RN-15 / BE-16 / BE-17: void (reverse) a previously applied
  // discount. Creates a new VOID record that mirrors the original amount.
  // The original DISCOUNT record is never modified or deleted (BE-17).
  voidAdjustment(
    workOrderId: string,
    userId: string,
    dto: VoidAdjustmentDto,
  ): Promise<SettlementAdjustmentResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.workOrder.findUnique({
        where: { id: workOrderId },
        select: {
          id: true,
          vehicleId: true,
          status: true,
          deliveredAt: true,
          quote: { select: { currency: true } },
        },
      });
      if (!order) throw new NotFoundException('Work order not found');
      if (order.status !== 'LISTO_ENTREGA') {
        throw new ConflictException('Work order must be in LISTO_ENTREGA to void adjustments');
      }
      if (order.deliveredAt) {
        throw new ConflictException('Work order has already been delivered');
      }

      // Find the original adjustment
      const original = await tx.settlementAdjustment.findUnique({
        where: { id: dto.adjustmentId },
      });
      if (!original || original.workOrderId !== workOrderId) {
        throw new NotFoundException('Adjustment not found or does not belong to this work order');
      }
      if (original.type !== 'DISCOUNT') {
        throw new ConflictException('Only DISCOUNT adjustments can be voided');
      }

      // Check that this DISCOUNT has not already been voided
      const existingVoid = await tx.settlementAdjustment.findFirst({
        where: {
          workOrderId,
          type: 'VOID',
          reason: { contains: original.id },
        },
      });
      if (existingVoid) {
        throw new ConflictException('This discount has already been voided');
      }

      // Create the VOID record (insert-only, BE-17)
      const voidRecord = await tx.settlementAdjustment.create({
        data: {
          workOrderId,
          type: 'VOID',
          amount: original.amount,
          reason: `VOID of adjustment ${original.id}: ${dto.reason}`,
          appliedBy: userId,
        },
      });

      // RN-19: immutable technical history entry
      await tx.technicalHistory.create({
        data: {
          vehicleId: order.vehicleId,
          description:
            `Work order ${workOrderId} settlement adjustment voided: original ${original.id} ` +
            `(${order.quote?.currency ?? 'BOB'} ${original.amount.toFixed(2)}). ` +
            `Reason: ${dto.reason}. Voided by user ${userId}`,
        },
      });

      return {
        id: voidRecord.id,
        workOrderId,
        type: AdjustmentType.VOID,
        amount: voidRecord.amount.toFixed(2),
        reason: voidRecord.reason,
        appliedBy: voidRecord.appliedBy,
        createdAt: voidRecord.createdAt,
      };
    });
  }
}
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { SettlementRepository } from './repositories/settlement.repository';
import { WorkOrderSettlementResponseDto } from './dto/work-order-settlement.response.dto';
import { DeliverWorkOrderDto } from './dto/deliver-work-order.dto';
import { DeliverWorkOrderResponseDto } from './dto/deliver-work-order.response.dto';
import { ApplyDiscountDto } from './dto/apply-discount.dto';
import { VoidAdjustmentDto } from './dto/void-adjustment.dto';
import { SettlementAdjustmentResponseDto, AdjustmentType } from './dto/settlement-adjustment.response.dto';
import { Prisma } from '../../generated/prisma/client';

@Injectable()
export class SettlementsService {
  constructor(private readonly repository: SettlementRepository) {}

  // US-20: build the consolidated settlement (RN-21) for an order that is
  // ready to be delivered. Only LISTO_ENTREGA is settled; every monetary
  // value is serialized as a string (BE-13).
  async getSettlement(workOrderId: string): Promise<WorkOrderSettlementResponseDto> {
    const context = await this.repository.findSettlementContext(workOrderId);
    if (!context) throw new NotFoundException('Work order not found');

    // RN-05 (E4): only LISTO_ENTREGA orders can be settled.
    if (context.status !== 'LISTO_ENTREGA') {
      throw new ConflictException('Work order must be in LISTO_ENTREGA to settle');
    }

    // RN-21: total = approved labor subtotal + installed parts subtotal.
    // Every monetary value is serialized with the DECIMAL(12,2) scale so the
    // API always returns two decimals (BE-13).
    const installedParts = (context.quote?.parts ?? []).filter((part) => part.status === 'INSTALLED');
    const partsSubtotal = installedParts.reduce(
      (sum, part) => sum.plus(part.subtotal),
      new Prisma.Decimal(0),
    );
    const laborSubtotal = context.quote?.laborSubtotal ?? new Prisma.Decimal(0);

    // RN-15: calculate active discounts from settlement adjustments
    const activeDiscounts = (context.settlementAdjustments ?? []).reduce(
      (sum, adj) => {
        if (adj.type === 'DISCOUNT') return sum.plus(adj.amount);
        if (adj.type === 'VOID') return sum.minus(adj.amount);
        return sum;
      },
      new Prisma.Decimal(0),
    );
    const total = partsSubtotal.plus(laborSubtotal);
    const totalAfterDiscounts = total.minus(activeDiscounts);

    return {
      workOrderId: context.id,
      status: context.status,
      plate: context.vehicle.plate,
      brand: context.vehicle.brand,
      model: context.vehicle.model,
      year: context.vehicle.year,
      customerName: context.customer.name,
      laborSubtotal: laborSubtotal.toFixed(2),
      parts: installedParts.map((part) => ({
        id: part.id,
        code: part.sparePart.code,
        name: part.sparePart.name,
        quantity: part.quantity,
        unitPrice: part.unitPrice.toFixed(2),
        subtotal: part.subtotal.toFixed(2),
      })),
      partsSubtotal: partsSubtotal.toFixed(2),
      total: total.toFixed(2),
      currency: context.quote?.currency ?? 'BOB',
      discountsTotal: activeDiscounts.toFixed(2),
      totalAfterDiscounts: totalAfterDiscounts.toFixed(2),
      adjustments: (context.settlementAdjustments ?? []).map((adj) => ({
        id: adj.id,
        type: adj.type as AdjustmentType,
        amount: adj.amount.toFixed(2),
        reason: adj.reason,
        createdAt: adj.createdAt,
      })),
    };
  }

  // US-20: settle the account and register the vehicle handover (RN-21,
  // RN-19). All business rules live here (BE-06); the repository performs the
  // atomic persistence (BE-16).
  async deliver(
    workOrderId: string,
    userId: string,
    dto: DeliverWorkOrderDto,
  ): Promise<DeliverWorkOrderResponseDto> {
    const context = await this.repository.findSettlementContext(workOrderId);
    if (!context) throw new NotFoundException('Work order not found');

    // RN-05 (E4): only LISTO_ENTREGA orders can be delivered.
    if (context.status !== 'LISTO_ENTREGA') {
      throw new ConflictException('Work order must be in LISTO_ENTREGA to be delivered');
    }

    // RN-21: an order already handed over cannot be settled again.
    if (context.deliveredAt) {
      throw new ConflictException('Work order has already been delivered');
    }

    return this.repository.deliverWorkOrder(workOrderId, userId, dto);
  }

  // US-20 / RN-15: apply a discount to the settlement. Only WORKSHOP_LEAD
  // may perform this operation. All rules live in the service (BE-06); the
  // repository performs the atomic persistence (BE-16).
  async applyDiscount(
    workOrderId: string,
    userId: string,
    dto: ApplyDiscountDto,
  ): Promise<SettlementAdjustmentResponseDto> {
    const context = await this.repository.findSettlementContext(workOrderId);
    if (!context) throw new NotFoundException('Work order not found');

    if (context.status !== 'LISTO_ENTREGA') {
      throw new ConflictException('Work order must be in LISTO_ENTREGA to apply discounts');
    }
    if (context.deliveredAt) {
      throw new ConflictException('Work order has already been delivered');
    }

    return this.repository.applyDiscount(workOrderId, userId, dto);
  }

  // US-20 / RN-15: void a previously applied discount on the settlement.
  async voidAdjustment(
    workOrderId: string,
    userId: string,
    dto: VoidAdjustmentDto,
  ): Promise<SettlementAdjustmentResponseDto> {
    const context = await this.repository.findSettlementContext(workOrderId);
    if (!context) throw new NotFoundException('Work order not found');

    if (context.status !== 'LISTO_ENTREGA') {
      throw new ConflictException('Work order must be in LISTO_ENTREGA to void adjustments');
    }
    if (context.deliveredAt) {
      throw new ConflictException('Work order has already been delivered');
    }

    return this.repository.voidAdjustment(workOrderId, userId, dto);
  }
}
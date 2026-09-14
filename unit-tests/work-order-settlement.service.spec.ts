import { ConflictException, NotFoundException } from '@nestjs/common';
import { SettlementsService } from '../src/modules/settlements/settlements.service';
import { SettlementRepository } from '../src/modules/settlements/repositories/settlement.repository';
import { DeliverWorkOrderDto, PaymentMethod } from '../src/modules/settlements/dto/deliver-work-order.dto';
import { Prisma } from '../src/generated/prisma/client';
import { ApplyDiscountDto } from '../src/modules/settlements/dto/apply-discount.dto';
import { VoidAdjustmentDto } from '../src/modules/settlements/dto/void-adjustment.dto';

describe('SettlementsService - getSettlement / deliver (US-20)', () => {
  let service: SettlementsService;
  let repository: jest.Mocked<SettlementRepository>;

  const WORK_ORDER_ID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
  const USER_ID = 'c3d4e5f6-a7b8-9012-cdef-123456789012';

  const DTO: DeliverWorkOrderDto = {
    paymentMethod: PaymentMethod.CASH,
    receiptNumber: 'F2026-00123',
    deliveryNotes: 'Delivered to the owner',
  };

  const baseContext = {
    id: WORK_ORDER_ID,
    status: 'LISTO_ENTREGA',
    deliveredAt: null,
    vehicleId: 'd4e5f6a7-b8c9-0123-def0-234567890123',
    vehicle: { plate: '2345-XYZ', brand: 'Toyota', model: 'Corolla', year: 2019 },
    customer: { name: 'Maria Fernandez' },
    quote: {
      laborSubtotal: new Prisma.Decimal('650.00'),
      partsSubtotal: new Prisma.Decimal('300.00'),
      currency: 'BOB',
      parts: [
        {
          id: 'p-1',
          status: 'INSTALLED',
          quantity: 1,
          unitPrice: new Prisma.Decimal('200.00'),
          subtotal: new Prisma.Decimal('200.00'),
          sparePart: { code: 'BP-001', name: 'Brake pads' },
        },
        {
          id: 'p-2',
          status: 'INSTALLED',
          quantity: 1,
          unitPrice: new Prisma.Decimal('100.00'),
          subtotal: new Prisma.Decimal('100.00'),
          sparePart: { code: 'OF-002', name: 'Oil filter' },
        },
        {
          id: 'p-3',
          status: 'RESERVED',
          quantity: 2,
          unitPrice: new Prisma.Decimal('80.00'),
          subtotal: new Prisma.Decimal('160.00'),
          sparePart: { code: 'SP-003', name: 'Spark plugs' },
        },
      ],
    },
    settlementAdjustments: [],
  };

  beforeEach(() => {
    repository = {
      findSettlementContext: jest.fn(),
      deliverWorkOrder: jest.fn(),
      applyDiscount: jest.fn(),
      voidAdjustment: jest.fn(),
    } as unknown as jest.Mocked<SettlementRepository>;

    service = new SettlementsService(repository);
  });

  describe('getSettlement', () => {
    it('throws NotFoundException when work order does not exist', async () => {
      repository.findSettlementContext.mockResolvedValue(null);
      await expect(service.getSettlement(WORK_ORDER_ID)).rejects.toThrow(NotFoundException);
    });

    it('rejects a work order not in LISTO_ENTREGA with 409 (RN-05)', async () => {
      repository.findSettlementContext.mockResolvedValue({ ...baseContext, status: 'EN_REPARACION' });
      await expect(service.getSettlement(WORK_ORDER_ID)).rejects.toThrow(ConflictException);
    });

    it('rejects an already delivered work order (ENTREGADO) with 409', async () => {
      repository.findSettlementContext.mockResolvedValue({ ...baseContext, status: 'ENTREGADO', deliveredAt: new Date() });
      await expect(service.getSettlement(WORK_ORDER_ID)).rejects.toThrow(ConflictException);
    });

    it('charges only INSTALLED parts plus labor subtotal (RN-21)', async () => {
      repository.findSettlementContext.mockResolvedValue(baseContext);

      const result = await service.getSettlement(WORK_ORDER_ID);

      expect(new Prisma.Decimal('650.00').equals(new Prisma.Decimal(result.laborSubtotal))).toBe(true);
      expect(new Prisma.Decimal('300.00').equals(new Prisma.Decimal(result.partsSubtotal))).toBe(true);
      expect(new Prisma.Decimal('950.00').equals(new Prisma.Decimal(result.total))).toBe(true);
      expect(result.parts).toHaveLength(2);
      expect(result.parts.every((part) => part.code !== 'SP-003')).toBe(true);
      expect(result.currency).toBe('BOB');
      expect(result.plate).toBe('2345-XYZ');
      expect(result.customerName).toBe('Maria Fernandez');
    });

    it('returns zero totals when the order has no quote', async () => {
      repository.findSettlementContext.mockResolvedValue({ ...baseContext, quote: null });

      const result = await service.getSettlement(WORK_ORDER_ID);

      expect(result.total).toBe('0.00');
      expect(result.laborSubtotal).toBe('0.00');
      expect(result.partsSubtotal).toBe('0.00');
      expect(result.parts).toEqual([]);
      expect(result.currency).toBe('BOB');
    });

    it('includes discountsTotal, totalAfterDiscounts and adjustments when discounts exist (RN-15)', async () => {
      const contextWithDiscounts = {
        ...baseContext,
        settlementAdjustments: [
          { id: 'adj-1', type: 'DISCOUNT', amount: new Prisma.Decimal('50.00'), reason: 'Descuento por demora', appliedBy: USER_ID, createdAt: new Date() },
          { id: 'void-1', type: 'VOID', amount: new Prisma.Decimal('50.00'), reason: 'VOID of adj-1', appliedBy: USER_ID, createdAt: new Date() },
        ],
      };
      repository.findSettlementContext.mockResolvedValue(contextWithDiscounts);

      const result = await service.getSettlement(WORK_ORDER_ID);

      expect(result.discountsTotal).toBe('0.00');
      expect(result.totalAfterDiscounts).toBe('950.00');
      expect(result.adjustments).toHaveLength(2);
    });

    it('calculates correct total when multiple active discounts exist (RN-15)', async () => {
      const contextMultipleDiscounts = {
        ...baseContext,
        settlementAdjustments: [
          { id: 'adj-1', type: 'DISCOUNT', amount: new Prisma.Decimal('50.00'), reason: 'Descuento 1', appliedBy: USER_ID, createdAt: new Date() },
          { id: 'adj-2', type: 'DISCOUNT', amount: new Prisma.Decimal('30.00'), reason: 'Descuento 2', appliedBy: USER_ID, createdAt: new Date() },
        ],
      };
      repository.findSettlementContext.mockResolvedValue(contextMultipleDiscounts);

      const result = await service.getSettlement(WORK_ORDER_ID);

      expect(result.discountsTotal).toBe('80.00');
      expect(result.totalAfterDiscounts).toBe('870.00');
      expect(result.adjustments).toHaveLength(2);
    });
  });

  describe('deliver', () => {
    it('throws NotFoundException when work order does not exist', async () => {
      repository.findSettlementContext.mockResolvedValue(null);
      await expect(service.deliver(WORK_ORDER_ID, USER_ID, DTO)).rejects.toThrow(NotFoundException);
    });

    it('rejects a work order not in LISTO_ENTREGA with 409 (RN-05)', async () => {
      repository.findSettlementContext.mockResolvedValue({ ...baseContext, status: 'APROBADO' });
      await expect(service.deliver(WORK_ORDER_ID, USER_ID, DTO)).rejects.toThrow(ConflictException);
    });

    it('rejects a second delivery with 409 (RN-21)', async () => {
      repository.findSettlementContext.mockResolvedValue({ ...baseContext, deliveredAt: new Date() });
      await expect(service.deliver(WORK_ORDER_ID, USER_ID, DTO)).rejects.toThrow(ConflictException);
    });

    it('delegates to the repository and returns the delivery result', async () => {
      repository.findSettlementContext.mockResolvedValue(baseContext);
      repository.deliverWorkOrder.mockResolvedValue({
        id: WORK_ORDER_ID,
        status: 'ENTREGADO',
        deliveredAt: new Date(),
        paymentMethod: PaymentMethod.CASH,
        receiptNumber: DTO.receiptNumber,
        totalCharged: '950.00',
        deliveryNotes: DTO.deliveryNotes ?? null,
      });

      const result = await service.deliver(WORK_ORDER_ID, USER_ID, DTO);

      expect(repository.deliverWorkOrder).toHaveBeenCalledWith(WORK_ORDER_ID, USER_ID, DTO);
      expect(result.status).toBe('ENTREGADO');
      expect(result.totalCharged).toBe('950.00');
    });

    it('charges the total after discounts are applied (RN-15)', async () => {
      const contextWithDiscounts = {
        ...baseContext,
        settlementAdjustments: [
          { id: 'adj-1', type: 'DISCOUNT', amount: new Prisma.Decimal('50.00'), reason: 'Descuento', appliedBy: USER_ID, createdAt: new Date() },
        ],
      };
      repository.findSettlementContext.mockResolvedValue(contextWithDiscounts);
      repository.deliverWorkOrder.mockResolvedValue({
        id: WORK_ORDER_ID,
        status: 'ENTREGADO',
        deliveredAt: new Date(),
        paymentMethod: PaymentMethod.CASH,
        receiptNumber: DTO.receiptNumber,
        totalCharged: '900.00',
        deliveryNotes: DTO.deliveryNotes ?? null,
      });

      const result = await service.deliver(WORK_ORDER_ID, USER_ID, DTO);

      expect(result.totalCharged).toBe('900.00');
    });
  });

  describe('applyDiscount', () => {
    const DISCOUNT_DTO: ApplyDiscountDto = { amount: 50, reason: 'Descuento por demora en entrega' };

    it('throws NotFoundException when work order does not exist', async () => {
      repository.findSettlementContext.mockResolvedValue(null);
      await expect(service.applyDiscount(WORK_ORDER_ID, USER_ID, DISCOUNT_DTO)).rejects.toThrow(NotFoundException);
    });

    it('rejects a work order not in LISTO_ENTREGA with 409', async () => {
      repository.findSettlementContext.mockResolvedValue({ ...baseContext, status: 'EN_REPARACION' });
      await expect(service.applyDiscount(WORK_ORDER_ID, USER_ID, DISCOUNT_DTO)).rejects.toThrow(ConflictException);
    });

    it('rejects a delivered work order with 409', async () => {
      repository.findSettlementContext.mockResolvedValue({ ...baseContext, deliveredAt: new Date() });
      await expect(service.applyDiscount(WORK_ORDER_ID, USER_ID, DISCOUNT_DTO)).rejects.toThrow(ConflictException);
    });

    it('delegates to the repository and returns the adjustment result', async () => {
      repository.findSettlementContext.mockResolvedValue(baseContext);
      repository.applyDiscount.mockResolvedValue({
        id: 'adj-1',
        workOrderId: WORK_ORDER_ID,
        type: 'DISCOUNT' as any,
        amount: '50.00',
        reason: 'Descuento por demora en entrega',
        appliedBy: USER_ID,
        createdAt: new Date(),
      });

      const result = await service.applyDiscount(WORK_ORDER_ID, USER_ID, DISCOUNT_DTO);

      expect(repository.applyDiscount).toHaveBeenCalledWith(WORK_ORDER_ID, USER_ID, DISCOUNT_DTO);
      expect(result.type).toBe('DISCOUNT');
      expect(result.amount).toBe('50.00');
    });
  });

  describe('voidAdjustment', () => {
    const VOID_DTO: VoidAdjustmentDto = { adjustmentId: 'adj-1', reason: 'Error en el calculo del descuento' };

    it('throws NotFoundException when work order does not exist', async () => {
      repository.findSettlementContext.mockResolvedValue(null);
      await expect(service.voidAdjustment(WORK_ORDER_ID, USER_ID, VOID_DTO)).rejects.toThrow(NotFoundException);
    });

    it('rejects a work order not in LISTO_ENTREGA with 409', async () => {
      repository.findSettlementContext.mockResolvedValue({ ...baseContext, status: 'APROBADO' });
      await expect(service.voidAdjustment(WORK_ORDER_ID, USER_ID, VOID_DTO)).rejects.toThrow(ConflictException);
    });

    it('rejects a delivered work order with 409', async () => {
      repository.findSettlementContext.mockResolvedValue({ ...baseContext, deliveredAt: new Date() });
      await expect(service.voidAdjustment(WORK_ORDER_ID, USER_ID, VOID_DTO)).rejects.toThrow(ConflictException);
    });

    it('delegates to the repository and returns the void result', async () => {
      repository.findSettlementContext.mockResolvedValue(baseContext);
      repository.voidAdjustment.mockResolvedValue({
        id: 'void-1',
        workOrderId: WORK_ORDER_ID,
        type: 'VOID' as any,
        amount: '50.00',
        reason: 'VOID of adjustment adj-1: Error en el calculo del descuento',
        appliedBy: USER_ID,
        createdAt: new Date(),
      });

      const result = await service.voidAdjustment(WORK_ORDER_ID, USER_ID, VOID_DTO);

      expect(repository.voidAdjustment).toHaveBeenCalledWith(WORK_ORDER_ID, USER_ID, VOID_DTO);
      expect(result.type).toBe('VOID');
    });
  });
});
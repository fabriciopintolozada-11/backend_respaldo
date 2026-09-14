import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { SettlementRepository } from '../src/modules/settlements/repositories/settlement.repository';
import { DeliverWorkOrderDto, PaymentMethod } from '../src/modules/settlements/dto/deliver-work-order.dto';
import { Prisma } from '../src/generated/prisma/client';
import { ApplyDiscountDto } from '../src/modules/settlements/dto/apply-discount.dto';
import { VoidAdjustmentDto } from '../src/modules/settlements/dto/void-adjustment.dto';

// US-20 / BE-16 / RN-21 / RN-19: the repository settles and delivers a
// vehicle as one atomic Prisma transaction. These tests assert the DELIVERED
// transition, the charged total and the immutable history entry.
describe('SettlementRepository.deliverWorkOrder (US-20)', () => {
  const WORK_ORDER_ID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
  const VEHICLE_ID = 'd4e5f6a7-b8c9-0123-def0-234567890123';
  const USER_ID = 'c3d4e5f6-a7b8-9012-cdef-123456789012';

  const DTO: DeliverWorkOrderDto = {
    paymentMethod: PaymentMethod.QR_TRANSFER,
    receiptNumber: 'F2026-00155',
    deliveryNotes: 'Handed over with keys and documents',
  };

  const makeTx = (overrides: Record<string, unknown> = {}) => {
    const tx = {
      workOrder: {
        findUnique: jest.fn().mockResolvedValue({
          id: WORK_ORDER_ID,
          vehicleId: VEHICLE_ID,
          status: 'READY_FOR_DELIVERY',
          deliveredAt: null,
          quote: {
            laborSubtotal: new Prisma.Decimal('650.00'),
            currency: 'BOB',
            parts: [
              { subtotal: new Prisma.Decimal('200.00'), status: 'INSTALLED', quantity: 1, sparePartId: 'sp-1', id: 'qp-1' },
              { subtotal: new Prisma.Decimal('100.00'), status: 'INSTALLED', quantity: 1, sparePartId: 'sp-2', id: 'qp-2' },
            ],
          },
          settlementAdjustments: [],
        }),
        update: jest.fn().mockResolvedValue(undefined),
      },
      // BE-E03: the release helper only touches RESERVED lines. These INSTALLED
      // lines (fully consumed) yield a pending reservation of zero, so no spare
      // part line is released and the consumed stock is left untouched.
      stockMovement: { aggregate: jest.fn().mockResolvedValue({ _sum: { quantity: 1 } }) },
      sparePart: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      quotePart: { update: jest.fn().mockResolvedValue(undefined) },
      settlementAdjustment: {
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: 'adj-mock', createdAt: new Date(), ...data }),
        ),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      technicalHistory: { create: jest.fn().mockResolvedValue(undefined) },
      ...overrides,
    };
    return tx;
  };

  const makeRepository = (tx: Record<string, unknown>) => {
    const prisma = {
      $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)),
    };
    return { repository: new SettlementRepository(prisma as never), prisma };
  };

  it('sets DELIVERED, persists payment data and records history (RN-21, RN-19)', async () => {
    const tx = makeTx();
    const { repository } = makeRepository(tx);

    const result = await repository.deliverWorkOrder(WORK_ORDER_ID, USER_ID, DTO);

    expect(tx.workOrder.update).toHaveBeenCalledWith({
      where: { id: WORK_ORDER_ID },
      data: {
        status: 'DELIVERED',
        deliveredAt: expect.any(Date),
        paymentMethod: 'QR_TRANSFER',
        receiptNumber: 'F2026-00155',
        totalCharged: expect.any(Prisma.Decimal),
        deliveryNotes: 'Handed over with keys and documents',
      },
    });
    const updateArgs = tx.workOrder.update.mock.calls[0][0];
    expect(updateArgs.data.totalCharged.toString()).toBe('950');
    expect(tx.technicalHistory.create).toHaveBeenCalledWith({
      data: {
        vehicleId: VEHICLE_ID,
        description: expect.stringContaining('Charged: BOB 950.00'),
      },
    });
    expect(tx.technicalHistory.create).toHaveBeenCalledWith({
      data: {
        vehicleId: VEHICLE_ID,
        description: expect.stringContaining(`Delivered by user ${USER_ID}`),
      },
    });
    expect(result).toMatchObject({
      id: WORK_ORDER_ID,
      status: 'DELIVERED',
      paymentMethod: 'QR_TRANSFER',
      receiptNumber: 'F2026-00155',
      totalCharged: '950.00',
      deliveryNotes: 'Handed over with keys and documents',
    });
    expect(typeof result.deliveredAt).toBe('object');
  });

  it('charges zero when the work order has no quote', async () => {
    const tx = makeTx({
      workOrder: {
        findUnique: jest.fn().mockResolvedValue({
          id: WORK_ORDER_ID,
          vehicleId: VEHICLE_ID,
          status: 'READY_FOR_DELIVERY',
          deliveredAt: null,
          quote: null,
          settlementAdjustments: [],
        }),
        update: jest.fn().mockResolvedValue(undefined),
      },
    });
    const { repository } = makeRepository(tx);

    const result = await repository.deliverWorkOrder(WORK_ORDER_ID, USER_ID, DTO);

    const updateArgs = tx.workOrder.update.mock.calls[0][0];
    expect(updateArgs.data.totalCharged.toString()).toBe('0');
    expect(result.totalCharged).toBe('0.00');
  });

  it('omits deliveryNotes from the update when not provided', async () => {
    const tx = makeTx();
    const { repository } = makeRepository(tx);

    await repository.deliverWorkOrder(WORK_ORDER_ID, USER_ID, { paymentMethod: PaymentMethod.CASH, receiptNumber: 'R-1' });

    const updateArgs = tx.workOrder.update.mock.calls[0][0];
    expect(updateArgs.data).not.toHaveProperty('deliveryNotes');
  });

  it('rejects a missing work order (404 semantics) and writes nothing', async () => {
    const tx = makeTx({
      workOrder: { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn() },
    });
    const { repository } = makeRepository(tx);

    await expect(repository.deliverWorkOrder(WORK_ORDER_ID, USER_ID, DTO))
      .rejects.toThrow(NotFoundException);
    expect(tx.workOrder.update).not.toHaveBeenCalled();
    expect(tx.technicalHistory.create).not.toHaveBeenCalled();
  });

  it('rejects an order not in READY_FOR_DELIVERY with 409 (RN-05)', async () => {
    const tx = makeTx({
      workOrder: {
        findUnique: jest.fn().mockResolvedValue({
          id: WORK_ORDER_ID,
          vehicleId: VEHICLE_ID,
          status: 'IN_REPAIR',
          deliveredAt: null,
          quote: null,
          settlementAdjustments: [],
        }),
        update: jest.fn(),
      },
    });
    const { repository } = makeRepository(tx);

    await expect(repository.deliverWorkOrder(WORK_ORDER_ID, USER_ID, DTO))
      .rejects.toThrow(ConflictException);
    expect(tx.workOrder.update).not.toHaveBeenCalled();
    expect(tx.technicalHistory.create).not.toHaveBeenCalled();
  });

  it('rejects a second delivery with 409 (RN-21)', async () => {
    const tx = makeTx({
      workOrder: {
        findUnique: jest.fn().mockResolvedValue({
          id: WORK_ORDER_ID,
          vehicleId: VEHICLE_ID,
          status: 'DELIVERED',
          deliveredAt: new Date('2026-09-10T15:00:00.000Z'),
          quote: null,
          settlementAdjustments: [],
        }),
        update: jest.fn(),
      },
    });
    const { repository } = makeRepository(tx);

    await expect(repository.deliverWorkOrder(WORK_ORDER_ID, USER_ID, DTO))
      .rejects.toThrow(ConflictException);
    expect(tx.workOrder.update).not.toHaveBeenCalled();
    expect(tx.technicalHistory.create).not.toHaveBeenCalled();
  });

  describe('applyDiscount', () => {
    const DISCOUNT_DTO: ApplyDiscountDto = { amount: 50, reason: 'Descuento por demora en entrega del vehiculo' };

    it('creates a DISCOUNT adjustment and technicalHistory entry (RN-15, RN-19)', async () => {
      const tx = makeTx();
      const { repository } = makeRepository(tx);

      const result = await repository.applyDiscount(WORK_ORDER_ID, USER_ID, DISCOUNT_DTO);

      expect(tx.settlementAdjustment.create).toHaveBeenCalledWith({
        data: {
          workOrderId: WORK_ORDER_ID,
          type: 'DISCOUNT',
          amount: expect.any(Prisma.Decimal),
          reason: 'Descuento por demora en entrega del vehiculo',
          appliedBy: USER_ID,
        },
      });
      expect(tx.technicalHistory.create).toHaveBeenCalled();
      expect(result.type).toBe('DISCOUNT');
      expect(result.amount).toBe('50.00');
    });

    it('rejects a missing work order (404) and writes nothing', async () => {
      const tx = makeTx({
        workOrder: { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn() },
      });
      const { repository } = makeRepository(tx);

      await expect(repository.applyDiscount(WORK_ORDER_ID, USER_ID, DISCOUNT_DTO))
        .rejects.toThrow(NotFoundException);
      expect(tx.settlementAdjustment.create).not.toHaveBeenCalled();
    });

    it('rejects a non READY_FOR_DELIVERY order with 409', async () => {
      const tx = makeTx({
        workOrder: {
          findUnique: jest.fn().mockResolvedValue({
            id: WORK_ORDER_ID, vehicleId: VEHICLE_ID, status: 'IN_REPAIR',
            deliveredAt: null, quote: null, settlementAdjustments: [],
          }),
          update: jest.fn(),
        },
      });
      const { repository } = makeRepository(tx);

      await expect(repository.applyDiscount(WORK_ORDER_ID, USER_ID, DISCOUNT_DTO))
        .rejects.toThrow(ConflictException);
      expect(tx.settlementAdjustment.create).not.toHaveBeenCalled();
    });

    it('rejects a discount amount exceeding the available total (422, RN-15)', async () => {
      const tx = makeTx();
      const { repository } = makeRepository(tx);

      await expect(repository.applyDiscount(WORK_ORDER_ID, USER_ID, { amount: 5000, reason: 'Descuento que excede el total de la liquidacion' }))
        .rejects.toThrow(UnprocessableEntityException);
      expect(tx.settlementAdjustment.create).not.toHaveBeenCalled();
      expect(tx.technicalHistory.create).not.toHaveBeenCalled();
    });
  });

  describe('voidAdjustment', () => {
    const VOID_DTO: VoidAdjustmentDto = { adjustmentId: 'adj-1', reason: 'Error en el calculo del descuento original' };

    it('creates a VOID adjustment and technicalHistory entry (RN-15, RN-19)', async () => {
      const tx = makeTx({
        settlementAdjustment: {
          create: jest.fn().mockImplementation(({ data }) =>
            Promise.resolve({ id: 'void-mock', createdAt: new Date(), ...data }),
          ),
          findUnique: jest.fn().mockResolvedValue({
            id: 'adj-1', workOrderId: WORK_ORDER_ID, type: 'DISCOUNT',
            amount: new Prisma.Decimal('50.00'), reason: 'Original',
          }),
          findFirst: jest.fn().mockResolvedValue(null),
          findMany: jest.fn().mockResolvedValue([]),
        },
      });
      const { repository } = makeRepository(tx);

      const result = await repository.voidAdjustment(WORK_ORDER_ID, USER_ID, VOID_DTO);

      expect(tx.settlementAdjustment.create).toHaveBeenCalledWith({
        data: {
          workOrderId: WORK_ORDER_ID,
          type: 'VOID',
          amount: expect.any(Prisma.Decimal),
          reason: expect.stringContaining('VOID of adjustment adj-1'),
          appliedBy: USER_ID,
        },
      });
      expect(tx.technicalHistory.create).toHaveBeenCalled();
      expect(result.type).toBe('VOID');
    });

    it('rejects when the adjustment does not belong to this work order (404)', async () => {
      const tx = makeTx({
        settlementAdjustment: {
          create: jest.fn(),
          findUnique: jest.fn().mockResolvedValue({
            id: 'adj-1', workOrderId: 'other-order', type: 'DISCOUNT',
            amount: new Prisma.Decimal('50.00'),
          }),
        },
      });
      const { repository } = makeRepository(tx);

      await expect(repository.voidAdjustment(WORK_ORDER_ID, USER_ID, VOID_DTO))
        .rejects.toThrow(NotFoundException);
      expect(tx.settlementAdjustment.create).not.toHaveBeenCalled();
    });

    it('rejects voiding a non-DISCOUNT adjustment (409)', async () => {
      const tx = makeTx({
        settlementAdjustment: {
          create: jest.fn(),
          findUnique: jest.fn().mockResolvedValue({
            id: 'adj-1', workOrderId: WORK_ORDER_ID, type: 'VOID',
            amount: new Prisma.Decimal('50.00'),
          }),
        },
      });
      const { repository } = makeRepository(tx);

      await expect(repository.voidAdjustment(WORK_ORDER_ID, USER_ID, VOID_DTO))
        .rejects.toThrow(ConflictException);
      expect(tx.settlementAdjustment.create).not.toHaveBeenCalled();
    });

    it('rejects voiding an already voided discount (409)', async () => {
      const tx = makeTx({
        settlementAdjustment: {
          create: jest.fn(),
          findUnique: jest.fn().mockResolvedValue({
            id: 'adj-1', workOrderId: WORK_ORDER_ID, type: 'DISCOUNT',
            amount: new Prisma.Decimal('50.00'),
          }),
          findFirst: jest.fn().mockResolvedValue({ id: 'void-9' }),
          findMany: jest.fn().mockResolvedValue([]),
        },
      });
      const { repository } = makeRepository(tx);

      await expect(repository.voidAdjustment(WORK_ORDER_ID, USER_ID, VOID_DTO))
        .rejects.toThrow(ConflictException);
      expect(tx.settlementAdjustment.create).not.toHaveBeenCalled();
    });
  });
});
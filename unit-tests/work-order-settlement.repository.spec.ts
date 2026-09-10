import { ConflictException, NotFoundException } from '@nestjs/common';
import { WorkOrderRepository } from '../src/modules/work-orders/repositories/work-order.repository';
import { DeliverWorkOrderDto, PaymentMethod } from '../src/modules/work-orders/dto/deliver-work-order.dto';
import { Prisma } from '../src/generated/prisma/client';

// US-20 / BE-16 / RN-21 / RN-19: the repository settles and delivers a
// vehicle as one atomic Prisma transaction. These tests assert the ENTREGADO
// transition, the charged total and the immutable history entry.
describe('WorkOrderRepository.deliverWorkOrder (US-20)', () => {
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
          status: 'LISTO_ENTREGA',
          deliveredAt: null,
          quote: {
            laborSubtotal: new Prisma.Decimal('650.00'),
            currency: 'BOB',
            parts: [
              { subtotal: new Prisma.Decimal('200.00') },
              { subtotal: new Prisma.Decimal('100.00') },
            ],
          },
        }),
        update: jest.fn().mockResolvedValue(undefined),
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
    return { repository: new WorkOrderRepository(prisma as never), prisma };
  };

  it('sets ENTREGADO, persists payment data and records history (RN-21, RN-19)', async () => {
    const tx = makeTx();
    const { repository } = makeRepository(tx);

    const result = await repository.deliverWorkOrder(WORK_ORDER_ID, USER_ID, DTO);

    expect(tx.workOrder.update).toHaveBeenCalledWith({
      where: { id: WORK_ORDER_ID },
      data: {
        status: 'ENTREGADO',
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
        description: expect.stringContaining('charged: BOB 950'),
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
      status: 'ENTREGADO',
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
          status: 'LISTO_ENTREGA',
          deliveredAt: null,
          quote: null,
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

  it('rejects an order not in LISTO_ENTREGA with 409 (RN-05)', async () => {
    const tx = makeTx({
      workOrder: {
        findUnique: jest.fn().mockResolvedValue({
          id: WORK_ORDER_ID,
          vehicleId: VEHICLE_ID,
          status: 'EN_REPARACION',
          deliveredAt: null,
          quote: null,
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
          status: 'ENTREGADO',
          deliveredAt: new Date('2026-09-10T15:00:00.000Z'),
          quote: null,
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
});
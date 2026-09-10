import { NotFoundException } from '@nestjs/common';
import { WorkOrderRepository } from '../src/modules/work-orders/repositories/work-order.repository';
import { CompleteWorkOrderDto } from '../src/modules/work-orders/dto/complete-work-order.dto';

// US-19 / BE-16 / RN-05 / RN-14 / RN-19: the repository concludes the repair
// as one atomic Prisma transaction. These tests assert the LISTO_ENTREGA
// transition, the bay release, the immutable history entry and the reception
// notification.
describe('WorkOrderRepository.completeWorkOrder (US-19)', () => {
  const dto: CompleteWorkOrderDto = {
    finalMileage: 125400,
    closingNotes: 'Radiator replaced and road-tested',
  };

  const makeTx = (overrides: Record<string, unknown> = {}) => {
    const tx = {
      workOrder: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'wo-1',
          vehicleId: 'veh-1',
          receptionistId: 'recep-1',
        }),
        update: jest.fn().mockResolvedValue(undefined),
      },
      workBay: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue(undefined),
      },
      technicalHistory: { create: jest.fn().mockResolvedValue(undefined) },
      notification: { create: jest.fn().mockResolvedValue(undefined) },
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

  it('sets LISTO_ENTREGA, frees the bay, records history and notifies reception (RN-05, RN-14, RN-19)', async () => {
    const tx = makeTx({
      workBay: {
        findFirst: jest.fn().mockResolvedValue({ id: 'bay-2', bayNumber: 2 }),
        update: jest.fn().mockResolvedValue(undefined),
      },
    });
    const { repository } = makeRepository(tx);

    const result = await repository.completeWorkOrder('wo-1', dto, 'mech-1');

    expect(tx.workOrder.update).toHaveBeenCalledWith({
      where: { id: 'wo-1' },
      data: { status: 'LISTO_ENTREGA' },
    });
    expect(tx.workBay.findFirst).toHaveBeenCalledWith({
      where: { currentWorkOrderId: 'wo-1' },
      select: { id: true, bayNumber: true },
    });
    expect(tx.workBay.update).toHaveBeenCalledWith({
      where: { id: 'bay-2' },
      data: { isOccupied: false, currentWorkOrderId: null },
    });
    expect(tx.technicalHistory.create).toHaveBeenCalledWith({
      data: {
        vehicleId: 'veh-1',
        description: expect.stringContaining('final mileage: 125400 km'),
      },
    });
    expect(tx.notification.create).toHaveBeenCalledWith({
      data: {
        recipientId: 'recep-1',
        workOrderId: 'wo-1',
        type: 'WORK_ORDER_READY',
        message: expect.stringContaining('wo-1'),
      },
    });
    expect(result).toMatchObject({ id: 'wo-1', status: 'LISTO_ENTREGA', bayNumber: 2 });
    expect(typeof result.completedAt).toBe('object');
  });

  it('does not touch a bay when the work order is not bound to one', async () => {
    const tx = makeTx();
    const { repository } = makeRepository(tx);

    const result = await repository.completeWorkOrder('wo-1', {}, 'mech-1');

    expect(tx.workBay.update).not.toHaveBeenCalled();
    expect(result).toMatchObject({ bayNumber: null, status: 'LISTO_ENTREGA' });
    expect(result.finalMileage).toBeNull();
    expect(result.closingNotes).toBeNull();
  });

  it('rejects a missing work order (404 semantics) and writes nothing else', async () => {
    const tx = makeTx({
      workOrder: { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn() },
    });
    const { repository } = makeRepository(tx);

    await expect(repository.completeWorkOrder('missing', dto, 'mech-1'))
      .rejects.toThrow(NotFoundException);
    expect(tx.workBay.update).not.toHaveBeenCalled();
    expect(tx.technicalHistory.create).not.toHaveBeenCalled();
    expect(tx.notification.create).not.toHaveBeenCalled();
  });
});
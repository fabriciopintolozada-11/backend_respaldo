import { UnprocessableEntityException } from '@nestjs/common';
import { WorkOrderRepository } from '../src/modules/work-orders/repositories/work-order.repository';
import { ConsumeSparePartDto } from '../src/modules/work-orders/dto/consume-spare-part.dto';

// HU-07 / BE-16 / RN-08: the repository performs the whole consumption as one
// atomic Prisma transaction. These tests assert the stock decrement, the
// INSTALLED status change, the kardex record and the negative-stock guard.
describe('WorkOrderRepository.consumePart (HU-07)', () => {
  const orderWithPart = (status = 'APROBADO', partStatus = 'RESERVED', quantity = 2) => ({
    id: 'wo-1',
    status,
    vehicleId: 'veh-1',
    quote: {
      parts: [
        {
          id: 'qp-1',
          sparePartId: 'sp-1',
          quantity,
          status: partStatus,
          sparePart: { code: 'FIL-01', name: 'Filtro' },
        },
      ],
    },
  });

  const dto: ConsumeSparePartDto = { quotePartId: 'qp-1', quantity: 1 };

  const makeTx = (overrides: Record<string, unknown> = {}) => {
    const tx = {
      workOrder: {
        findUnique: jest.fn().mockResolvedValue(orderWithPart()),
        update: jest.fn().mockResolvedValue(undefined),
      },
      sparePart: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      quotePart: { update: jest.fn().mockResolvedValue(undefined) },
      stockMovement: { create: jest.fn().mockResolvedValue(undefined) },
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

  it('decrements physical and reserved stock, marks INSTALLED and records the kardex (RN-08)', async () => {
    const tx = makeTx();
    const { repository } = makeRepository(tx);

    const result = await repository.consumePart('wo-1', dto, 'mech-1', 'EN_REPARACION');

    expect(tx.sparePart.updateMany).toHaveBeenCalledWith({
      where: { id: 'sp-1', physicalStock: { gte: 1 }, reservedStock: { gte: 1 } },
      data: { physicalStock: { decrement: 1 }, reservedStock: { decrement: 1 }, lastMovementAt: expect.any(Date) },
    });
    expect(tx.quotePart.update).toHaveBeenCalledWith({
      where: { id: 'qp-1' },
      data: { status: 'INSTALLED' },
    });
    expect(tx.workOrder.update).toHaveBeenCalledWith({
      where: { id: 'wo-1' },
      data: { status: 'EN_REPARACION' },
    });
    expect(tx.stockMovement.create).toHaveBeenCalledWith({
      data: {
        workOrderId: 'wo-1',
        sparePartId: 'sp-1',
        userId: 'mech-1',
        quantity: 1,
        type: 'OUT',
      },
    });
    expect(tx.technicalHistory.create).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ id: 'qp-1', code: 'FIL-01', name: 'Filtro', quantity: 1, status: 'INSTALLED' });
  });

  it('does not transition state when nextStatus equals the current status', async () => {
    const tx = makeTx();
    const { repository } = makeRepository(tx);
    tx.workOrder.findUnique = jest.fn().mockResolvedValue(orderWithPart('EN_REPARACION'));

    await repository.consumePart('wo-1', dto, 'mech-1', 'EN_REPARACION');

    expect(tx.workOrder.update).not.toHaveBeenCalled();
  });

  it('rejects consumption when physical stock is insufficient and writes nothing else (RN-01)', async () => {
    const tx = makeTx({ sparePart: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) } });
    const { repository } = makeRepository(tx);

    await expect(repository.consumePart('wo-1', dto, 'mech-1', 'EN_REPARACION'))
      .rejects.toThrow(UnprocessableEntityException);
    expect(tx.quotePart.update).not.toHaveBeenCalled();
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
    expect(tx.technicalHistory.create).not.toHaveBeenCalled();
  });

  it('rejects consumption when the part is not RESERVED (RN-07)', async () => {
    const tx = makeTx();
    const { repository } = makeRepository(tx);
    tx.workOrder.findUnique = jest.fn().mockResolvedValue(orderWithPart('APROBADO', 'INSTALLED'));

    await expect(repository.consumePart('wo-1', dto, 'mech-1', 'EN_REPARACION'))
      .rejects.toThrow(UnprocessableEntityException);
    expect(tx.sparePart.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a missing work order (404 semantics)', async () => {
    const tx = makeTx({ workOrder: { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn() } });
    const { repository } = makeRepository(tx);

    await expect(repository.consumePart('wo-1', dto, 'mech-1', 'EN_REPARACION')).rejects.toThrow('Work order not found');
    expect(tx.sparePart.updateMany).not.toHaveBeenCalled();
  });
});

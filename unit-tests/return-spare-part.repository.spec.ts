import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { WorkOrderRepository } from '../src/modules/work-orders/repositories/work-order.repository';
import { ReturnSparePartDto } from '../src/modules/work-orders/dto/return-spare-part.dto';

// HU-07 / BE-E03 / BE-16 / RN-08 / RN-01: the repository restores the
// discounted physical stock and records the kardex IN movement atomically.
// These tests assert the stock restore, the RELEASED/INSTALLED status logic,
// the groupBy guard (net consumed units) and the immutable audit trail.
describe('WorkOrderRepository.returnPart (HU-07 / BE-E03)', () => {
  const orderWithPart = (status = 'IN_REPAIR', partStatus = 'INSTALLED', quantity = 2) => ({
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

  const dto: ReturnSparePartDto = { sparePartId: 'sp-1', quantity: 1 };

  const makeTx = (overrides: Record<string, unknown> = {}) => {
    const tx = {
      workOrder: {
        findUnique: jest.fn().mockResolvedValue(orderWithPart()),
      },
      stockMovement: {
        groupBy: jest.fn().mockResolvedValue([{ type: 'OUT', _sum: { quantity: 2 } }]),
        create: jest.fn().mockResolvedValue(undefined),
      },
      sparePart: {
        findUnique: jest.fn().mockResolvedValue({ physicalStock: 5, isActive: true }),
        update: jest.fn().mockResolvedValue({ physicalStock: 6 }),
      },
      quotePart: { update: jest.fn().mockResolvedValue(undefined) },
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

  it('restores physical and available stock, records the kardex IN and releases the line (RN-08, RN-19)', async () => {
    const tx = makeTx();
    const { repository } = makeRepository(tx);

    const result = await repository.returnPart('wo-1', dto, 'mech-1');

    expect(tx.sparePart.update).toHaveBeenCalledWith({
      where: { id: 'sp-1' },
      data: {
        physicalStock: { increment: 1 },
        availableStock: { increment: 1 },
        lastMovementAt: expect.any(Date),
      },
    });
    expect(tx.stockMovement.create).toHaveBeenCalledWith({
      data: {
        workOrderId: 'wo-1',
        sparePartId: 'sp-1',
        userId: 'mech-1',
        quantity: 1,
        type: 'IN',
        reason: 'Spare part returned to stock for work order wo-1',
        previousPhysicalStock: 5,
        newPhysicalStock: 6,
      },
    });
    // Full return of the consumed units (2 OUT, 1 IN now) -> 1 unit remains
    // installed, so the line stays INSTALLED and keeps being billed.
    expect(tx.quotePart.update).toHaveBeenCalledWith({
      where: { id: 'qp-1' },
      data: { status: 'INSTALLED' },
    });
    expect(tx.technicalHistory.create).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ id: 'qp-1', code: 'FIL-01', name: 'Filtro', quantity: 1, status: 'INSTALLED' });
  });

  it('releases the line when all consumed units are returned (net consumed zero)', async () => {
    const tx = makeTx({ stockMovement: { groupBy: jest.fn().mockResolvedValue([{ type: 'OUT', _sum: { quantity: 1 } }]), create: jest.fn() } });
    const { repository } = makeRepository(tx);

    const result = await repository.returnPart('wo-1', { sparePartId: 'sp-1', quantity: 1 }, 'mech-1');

    expect(tx.quotePart.update).toHaveBeenCalledWith({
      where: { id: 'qp-1' },
      data: { status: 'RELEASED' },
    });
    expect(result.status).toBe('RELEASED');
  });

  it('records the optional notes as the kardex reason', async () => {
    const tx = makeTx();
    const { repository } = makeRepository(tx);

    await repository.returnPart('wo-1', { ...dto, notes: 'Pieza incorrecta para este vehículo' }, 'mech-1');

    expect(tx.stockMovement.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ reason: 'Pieza incorrecta para este vehículo', type: 'IN' }),
    }));
  });

  it('rejects when the quantity exceeds the net consumed units and writes nothing else (RN-01)', async () => {
    const tx = makeTx({ stockMovement: { groupBy: jest.fn().mockResolvedValue([{ type: 'OUT', _sum: { quantity: 1 } }]), create: jest.fn() } });
    const { repository } = makeRepository(tx);

    await expect(repository.returnPart('wo-1', { ...dto, quantity: 2 }, 'mech-1'))
      .rejects.toThrow(UnprocessableEntityException);
    expect(tx.sparePart.update).not.toHaveBeenCalled();
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
    expect(tx.technicalHistory.create).not.toHaveBeenCalled();
  });

  it('rejects when the part was never consumed in this work order (RN-01)', async () => {
    const tx = makeTx({ stockMovement: { groupBy: jest.fn().mockResolvedValue([{ type: 'OUT', _sum: { quantity: 0 } }]), create: jest.fn() } });
    const { repository } = makeRepository(tx);

    await expect(repository.returnPart('wo-1', dto, 'mech-1'))
      .rejects.toThrow(UnprocessableEntityException);
    expect(tx.sparePart.update).not.toHaveBeenCalled();
  });

  it('accounts previous returns so stock is never restored twice (IN subtracts from net)', async () => {
    const tx = makeTx({
      stockMovement: {
        groupBy: jest.fn().mockResolvedValue([
          { type: 'OUT', _sum: { quantity: 2 } },
          { type: 'IN', _sum: { quantity: 1 } },
        ]),
        create: jest.fn(),
      },
    });
    const { repository } = makeRepository(tx);

    // Net consumed = 1; returning 2 must be rejected even though 2 were consumed.
    await expect(repository.returnPart('wo-1', { ...dto, quantity: 2 }, 'mech-1'))
      .rejects.toThrow(UnprocessableEntityException);
    expect(tx.sparePart.update).not.toHaveBeenCalled();
  });

  it('rejects when the spare part belongs to no order part (404 semantics)', async () => {
    const tx = makeTx({
      workOrder: {
        findUnique: jest.fn().mockResolvedValue({ id: 'wo-1', status: 'IN_REPAIR', vehicleId: 'veh-1', quote: { parts: [] } }),
      },
    });
    const { repository } = makeRepository(tx);

    await expect(repository.returnPart('wo-1', dto, 'mech-1')).rejects.toThrow('Work order not found');
    expect(tx.sparePart.update).not.toHaveBeenCalled();
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
  });

  it('rejects when the spare part is inactive or missing (404 semantics)', async () => {
    const tx = makeTx({ sparePart: { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn() } });
    const { repository } = makeRepository(tx);

    await expect(repository.returnPart('wo-1', dto, 'mech-1'))
      .rejects.toThrow(NotFoundException);
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
  });

  it('rejects a missing work order (404 semantics)', async () => {
    const tx = makeTx({ workOrder: { findUnique: jest.fn().mockResolvedValue(null) } });
    const { repository } = makeRepository(tx);

    await expect(repository.returnPart('wo-1', dto, 'mech-1')).rejects.toThrow('Work order not found');
    expect(tx.sparePart.update).not.toHaveBeenCalled();
  });
});
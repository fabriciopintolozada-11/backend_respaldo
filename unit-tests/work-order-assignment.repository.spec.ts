import { NotFoundException } from '@nestjs/common';
import { WorkOrderRepository } from '../src/modules/work-orders/repositories/work-order.repository';

describe('WorkOrderRepository HU-04 queries and assignment', () => {
  const prisma = {
    workOrder: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    mechanic: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  let repository: WorkOrderRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new WorkOrderRepository(prisma as never);
  });

  it('queries only unassigned received work orders with pagination', async () => {
    const row = {
      id: 'work-order-1',
      vehicleId: 'vehicle-1',
      status: 'RECIBIDO',
      initialComplaint: 'Engine noise',
      createdAt: new Date(),
      mechanicId: null,
      vehicle: {
        plate: 'ABC-123',
        brand: 'Toyota',
        model: 'Corolla',
        year: 2024,
        customer: { name: 'Customer One', identification: 'ID-1' },
      },
    };
    prisma.workOrder.findMany.mockResolvedValue([row]);

    await expect(repository.findAvailable(2, 10)).resolves.toEqual([{
      id: row.id,
      vehicleId: row.vehicleId,
      plate: 'ABC-123',
      vehicleBrand: 'Toyota',
      vehicleModel: 'Corolla',
      vehicleYear: 2024,
      customerName: 'Customer One',
      customerIdentification: 'ID-1',
      initialComplaint: 'Engine noise',
      status: 'RECIBIDO',
      createdAt: row.createdAt,
      mechanicId: null,
    }]);
    expect(prisma.workOrder.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: 'RECIBIDO', mechanicId: null },
      skip: 10,
      take: 10,
    }));
  });

  it('queries active mechanics with their name from the users table', async () => {
    prisma.mechanic.findMany.mockResolvedValue([{ id: 'mechanic-1', isActive: true }]);
    prisma.user.findMany.mockResolvedValue([{ id: 'mechanic-1', fullName: 'Mecánico Uno' }]);

    await expect(repository.findActiveMechanics(1, 20)).resolves.toEqual([{
      id: 'mechanic-1', isActive: true, name: 'Mecánico Uno',
    }]);
    expect(prisma.mechanic.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { isActive: true },
      take: 20,
    }));
    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { in: ['mechanic-1'] } },
      select: { id: true, fullName: true },
    }));
  });

  it('falls back to null name when a mechanic has no matching user', async () => {
    prisma.mechanic.findMany.mockResolvedValue([{ id: 'orphan-mechanic', isActive: true }]);
    prisma.user.findMany.mockResolvedValue([]);

    await expect(repository.findActiveMechanics(1, 20)).resolves.toEqual([{
      id: 'orphan-mechanic', isActive: true, name: null,
    }]);
  });

  it('assigns a received order to an active mechanic atomically', async () => {
    const transaction = {
      workOrder: {
        findUnique: jest.fn().mockResolvedValue({ id: 'work-order-1', status: 'RECIBIDO', mechanicId: null }),
        update: jest.fn().mockResolvedValue({
          id: 'work-order-1', mechanicId: 'mechanic-1', status: 'ASIGNADA', updatedAt: new Date(),
        }),
      },
      mechanic: { findUnique: jest.fn().mockResolvedValue({ id: 'mechanic-1', isActive: true }) },
    };
    prisma.$transaction.mockImplementation((callback: (value: typeof transaction) => unknown) => callback(transaction));

    await expect(repository.assign('work-order-1', 'mechanic-1')).resolves.toMatchObject({
      id: 'work-order-1', mechanicId: 'mechanic-1', status: 'ASIGNADA',
    });
    expect(transaction.workOrder.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'work-order-1' },
      data: { mechanicId: 'mechanic-1', assignedAt: expect.any(Date), status: 'ASIGNADA' },
    }));
  });

  it('rejects assignment when the work order does not exist', async () => {
    const transaction = {
      workOrder: { findUnique: jest.fn().mockResolvedValue(null) },
      mechanic: { findUnique: jest.fn() },
    };
    prisma.$transaction.mockImplementation((callback: (value: typeof transaction) => unknown) => callback(transaction));

    await expect(repository.assign('missing-order', 'mechanic-1')).rejects.toBeInstanceOf(NotFoundException);
    expect(transaction.mechanic.findUnique).not.toHaveBeenCalled();
  });
});

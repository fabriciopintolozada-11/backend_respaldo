import { ConflictException, NotFoundException } from '@nestjs/common';
import { WorkBayRepository } from '../src/modules/work-bays/repositories/work-bay.repository';

describe('WorkBayRepository (US-18)', () => {
  const workBay = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  };
  const workOrder = {
    findUnique: jest.fn(),
  };
  const user = {
    findMany: jest.fn(),
  };
  const prismaMock = {
    workBay,
    workOrder,
    user,
  };
  const prisma = {
    ...prismaMock,
    $transaction: jest.fn((cb: (tx: typeof prismaMock) => unknown) => cb(prismaMock)),
  };
  let repository: WorkBayRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new WorkBayRepository(prisma as never);
  });

  describe('findAllByNumber', () => {
    it('loads bays ordered by number and enriches mechanic names from users (BE-T18.2)', async () => {
      workBay.findMany.mockResolvedValue([
        {
          id: 'bay-1', bayNumber: 1, isOccupied: true, currentWorkOrderId: 'wo-1',
          createdAt: new Date(), updatedAt: new Date(),
          currentWorkOrder: {
            id: 'wo-1', status: 'IN_REPAIR', assignedAt: new Date(),
            vehicle: { plate: '4589-KXA', brand: 'Toyota', model: 'Hilux' },
            mechanic: { id: '11111111-1111-4111-8111-111111111111' },
          },
        },
        {
          id: 'bay-3', bayNumber: 3, isOccupied: false, currentWorkOrderId: null,
          createdAt: new Date(), updatedAt: new Date(),
          currentWorkOrder: null,
        },
      ]);
      user.findMany.mockResolvedValue([
        { id: '11111111-1111-4111-8111-111111111111', fullName: 'Mecánico Uno' },
      ]);

      const rows = await repository.findAllByNumber();

      expect(rows).toHaveLength(2);
      expect(workBay.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { bayNumber: 'asc' } }));
      expect(rows[0].mechanicName).toBe('Mecánico Uno');
      expect(rows[1].mechanicName).toBeNull();
      expect(user.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['11111111-1111-4111-8111-111111111111'] } },
        select: { id: true, fullName: true },
      });
    });
  });

  describe('assignWorkOrder', () => {
    it('frees the previous bay and occupies the target bay atomically (BE-16)', async () => {
      workBay.findUnique.mockResolvedValue({
        id: 'bay-2', bayNumber: 2, isOccupied: false, currentWorkOrderId: null,
      });
      workOrder.findUnique.mockResolvedValue({ id: 'wo-1', status: 'APPROVED' });
      workBay.findFirst.mockResolvedValueOnce({
        id: 'bay-1', bayNumber: 1, isOccupied: true, currentWorkOrderId: 'wo-1',
      });
      workBay.update
        .mockResolvedValueOnce({ id: 'bay-1', isOccupied: false, currentWorkOrderId: null })
        .mockResolvedValueOnce({
          id: 'bay-2', bayNumber: 2, isOccupied: true, currentWorkOrderId: 'wo-1', updatedAt: new Date(),
        });

      const result = await repository.assignWorkOrder('bay-2', 'wo-1');

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(workBay.update).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ where: { id: 'bay-1' }, data: { isOccupied: false, currentWorkOrderId: null } }),
      );
      expect(workBay.update).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ where: { id: 'bay-2' }, data: { isOccupied: true, currentWorkOrderId: 'wo-1' } }),
      );
      expect(result).toMatchObject({ bayNumber: 2, isOccupied: true, currentWorkOrderId: 'wo-1' });
    });

    it('rejects with 404 when the bay does not exist', async () => {
      workBay.findUnique.mockResolvedValue(null);
      await expect(repository.assignWorkOrder('missing', 'wo-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects with 404 when the work order does not exist', async () => {
      workBay.findUnique.mockResolvedValue({ id: 'bay-2', isOccupied: false, currentWorkOrderId: null });
      workOrder.findUnique.mockResolvedValue(null);
      await expect(repository.assignWorkOrder('bay-2', 'missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects with 409 when the target bay is already occupied (US-18 capacity)', async () => {
      workBay.findUnique.mockResolvedValue({
        id: 'bay-2', bayNumber: 2, isOccupied: true, currentWorkOrderId: 'wo-9',
      });
      workOrder.findUnique.mockResolvedValue({ id: 'wo-1', status: 'IN_REPAIR' });

      await expect(repository.assignWorkOrder('bay-2', 'wo-1')).rejects.toBeInstanceOf(ConflictException);
      expect(workBay.update).not.toHaveBeenCalled();
    });

    it('rejects with 422 semantics when the work order is in a closed state', async () => {
      workBay.findUnique.mockResolvedValue({ id: 'bay-2', isOccupied: false, currentWorkOrderId: null });
      workOrder.findUnique.mockResolvedValue({ id: 'wo-1', status: 'DELIVERED' });

      await expect(repository.assignWorkOrder('bay-2', 'wo-1')).rejects.toThrow(
        'Work order in status "DELIVERED" cannot be assigned to a bay',
      );
      expect(workBay.update).not.toHaveBeenCalled();
    });
  });

  describe('setOccupied', () => {
    it('frees the bay and disconnects the work order', async () => {
      workBay.findUnique.mockResolvedValue({
        id: 'bay-1', isOccupied: true, currentWorkOrderId: 'wo-1',
      });
      workBay.update.mockResolvedValue({ id: 'bay-1', isOccupied: false, currentWorkOrderId: null, updatedAt: new Date() });

      await repository.setOccupied('bay-1', false);

      expect(workBay.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isOccupied: false, currentWorkOrderId: null } }),
      );
    });

    it('rejects occupying a bay that has no work order', async () => {
      workBay.findUnique.mockResolvedValue({ id: 'bay-3', isOccupied: false, currentWorkOrderId: null });
      await expect(repository.setOccupied('bay-3', true)).rejects.toThrow(
        'Cannot occupy a bay without a work order; use the assign operation instead',
      );
    });

    it('rejects with 404 when the bay does not exist', async () => {
      workBay.findUnique.mockResolvedValue(null);
      await expect(repository.setOccupied('missing', false)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
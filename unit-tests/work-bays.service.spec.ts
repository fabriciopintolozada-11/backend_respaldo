import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { WorkBaysService } from '../src/modules/work-bays/work-bays.service';

describe('WorkBaysService (US-18)', () => {
  const repository = {
    findAllByNumber: jest.fn(),
    assignWorkOrder: jest.fn(),
    setOccupied: jest.fn(),
  };
  let service: WorkBaysService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WorkBaysService(repository as never);
  });

  describe('getMonitoring', () => {
    it('returns the 4 bays with derived status and elapsed hours (US-18, RN-05)', async () => {
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);
      const assignedAt = new Date(now - 3_600_000 * 2.5); // 2.5 h ago

      repository.findAllByNumber.mockResolvedValue([
        {
          id: 'bay-1', bayNumber: 1, isOccupied: true, currentWorkOrderId: 'wo-1',
          createdAt: new Date(), updatedAt: assignedAt, mechanicName: null,
          currentWorkOrder: {
            id: 'wo-1', status: 'WAITING_FOR_PART', assignedAt,
            vehicle: { plate: '4589-KXA', brand: 'Toyota', model: 'Hilux' },
            mechanic: { id: 'mech-1' },
          },
        },
        {
          id: 'bay-2', bayNumber: 2, isOccupied: true, currentWorkOrderId: 'wo-2',
          createdAt: new Date(), updatedAt: new Date(), mechanicName: 'Mecánico Uno',
          currentWorkOrder: {
            id: 'wo-2', status: 'IN_REPAIR', assignedAt,
            vehicle: { plate: '3210-BCD', brand: 'Mazda', model: 'CX-5' },
            mechanic: { id: 'mech-1' },
          },
        },
        {
          id: 'bay-3', bayNumber: 3, isOccupied: false, currentWorkOrderId: null,
          createdAt: new Date(), updatedAt: new Date(), mechanicName: null,
          currentWorkOrder: null,
        },
      ]);

      const result = await service.getMonitoring();

      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({ bayNumber: 1, status: 'WAITING_FOR_PART', isOccupied: true });
      expect(result[1]).toMatchObject({ bayNumber: 2, status: 'OCCUPIED' });
      expect(result[2]).toMatchObject({ bayNumber: 3, status: 'FREE' });
      expect(result[0].currentWorkOrder?.elapsedHours).toBe(2.5);
      expect(repository.findAllByNumber).toHaveBeenCalledTimes(1);
    });

    it('keeps bays ordered and returns an empty list when no bays exist', async () => {
      repository.findAllByNumber.mockResolvedValue([]);
      await expect(service.getMonitoring()).resolves.toEqual([]);
    });
  });

  describe('assign', () => {
    it('delegates to the repository and preserves a successful assignment', async () => {
      const response = { id: 'bay-1', bayNumber: 1, isOccupied: true, currentWorkOrderId: 'wo-1', updatedAt: new Date() };
      repository.assignWorkOrder.mockResolvedValue(response);

      await expect(service.assign('bay-1', { workOrderId: 'wo-1' })).resolves.toBe(response);
      expect(repository.assignWorkOrder).toHaveBeenCalledWith('bay-1', 'wo-1');
    });

    it('re-throws 404 when bay or work order does not exist', async () => {
      repository.assignWorkOrder.mockRejectedValueOnce(new NotFoundException('Work bay not found'));
      await expect(service.assign('missing', { workOrderId: 'wo-1' })).rejects.toBeInstanceOf(NotFoundException);

      repository.assignWorkOrder.mockRejectedValueOnce(new NotFoundException('Work order not found'));
      await expect(service.assign('bay-1', { workOrderId: 'missing' })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('re-throws 409 when the bay is already occupied (capacity complete)', async () => {
      repository.assignWorkOrder.mockRejectedValue(
        new ConflictException('Capacity complete: the 4 bays are occupied. The vehicle must remain in the waiting queue'),
      );
      await expect(service.assign('bay-1', { workOrderId: 'wo-1' })).rejects.toBeInstanceOf(ConflictException);
    });

    it('maps repository state rule failures to 422', async () => {
      repository.assignWorkOrder.mockRejectedValue(new Error('Work order in status "DELIVERED" cannot be assigned to a bay'));
      await expect(service.assign('bay-1', { workOrderId: 'wo-1' })).rejects.toBeInstanceOf(UnprocessableEntityException);
    });
  });

  describe('setStatus', () => {
    it('frees the bay when isOccupied is false', async () => {
      const response = { id: 'bay-1', bayNumber: 1, isOccupied: false, currentWorkOrderId: null, updatedAt: new Date() };
      repository.setOccupied.mockResolvedValue(response);
      await expect(service.setStatus('bay-1', { isOccupied: false })).resolves.toBe(response);
      expect(repository.setOccupied).toHaveBeenCalledWith('bay-1', false);
    });

    it('maps occupation without a work order to 422', async () => {
      repository.setOccupied.mockRejectedValue(new Error('Cannot occupy a bay without a work order; use the assign operation instead'));
      await expect(service.setStatus('bay-1', { isOccupied: true })).rejects.toBeInstanceOf(UnprocessableEntityException);
    });
  });
});
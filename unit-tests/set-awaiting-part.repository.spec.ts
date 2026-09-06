import { WorkOrderRepository } from '../src/modules/work-orders/repositories/work-order.repository';
import { SetAwaitingPartDto } from '../src/modules/work-orders/dto/set-awaiting-part.dto';

describe('WorkOrderRepository - setAwaitingPart (US-13)', () => {
  let repository: WorkOrderRepository;
  let prisma: {
    workOrder: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };

  const WORK_ORDER_ID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
  const VEHICLE_ID = 'c3d4e5f6-a7b8-9012-cdef-123456789012';
  const USER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  const SPARE_PART_ID = 'd4e5f6a7-b8c9-0123-def0-234567890123';

  const dto: SetAwaitingPartDto = {
    missingPartId: SPARE_PART_ID,
    quantity: 2,
    reason: 'Part not found on shelf',
  };

  beforeEach(() => {
    prisma = {
      workOrder: { findUnique: jest.fn() },
      $transaction: jest.fn(),
    } as never;

    repository = new WorkOrderRepository(prisma as never);
  });

  // --- findAwaitingPartContext ---

  describe('findAwaitingPartContext', () => {
    it('returns null when work order does not exist', async () => {
      prisma.workOrder.findUnique.mockResolvedValue(null);

      const result = await repository.findAwaitingPartContext(WORK_ORDER_ID);
      expect(result).toBeNull();
    });

    it('returns context with status, mechanicId, vehicleId and quote parts', async () => {
      const mockContext = {
        id: WORK_ORDER_ID,
        status: 'EN_REPARACION',
        mechanicId: USER_ID,
        vehicleId: VEHICLE_ID,
        quote: {
          parts: [
            { id: 'qp-1', sparePartId: SPARE_PART_ID, quantity: 3, status: 'RESERVED' },
          ],
        },
      };
      prisma.workOrder.findUnique.mockResolvedValue(mockContext);

      const result = await repository.findAwaitingPartContext(WORK_ORDER_ID);
      expect(result).toEqual(mockContext);
    });
  });

  // --- setAwaitingPart (transaction) ---

  describe('setAwaitingPart', () => {
    it('executes status update, history entry and discrepancy in a single transaction', async () => {
      const createdAt = new Date('2026-09-04T12:00:00Z');

      const mockTx = {
        workOrder: { update: jest.fn().mockResolvedValue({}) },
        technicalHistory: { create: jest.fn().mockResolvedValue({}) },
        inventoryDiscrepancy: {
          create: jest.fn().mockResolvedValue({ createdAt }),
        },
      };

      prisma.$transaction.mockImplementation(async (fn: (tx: typeof mockTx) => Promise<unknown>) => {
        return fn(mockTx);
      });

      const result = await repository.setAwaitingPart(
        WORK_ORDER_ID,
        dto,
        USER_ID,
        VEHICLE_ID,
      );

      // Verify the transaction was called
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);

      // Verify work order status was updated
      expect(mockTx.workOrder.update).toHaveBeenCalledWith({
        where: { id: WORK_ORDER_ID },
        data: { status: 'EN_ESPERA_DE_REPUESTO' },
      });

      // Verify immutable technical history was created (RN-19)
      expect(mockTx.technicalHistory.create).toHaveBeenCalledWith({
        data: {
          vehicleId: VEHICLE_ID,
          description: expect.stringContaining('AWAITING_PART'),
        },
      });

      // Verify the description contains the part id, quantity and reason
      const historyCall = mockTx.technicalHistory.create.mock.calls[0][0];
      expect(historyCall.data.description).toContain(SPARE_PART_ID);
      expect(historyCall.data.description).toContain('2');
      expect(historyCall.data.description).toContain('Part not found on shelf');
      expect(historyCall.data.description).toContain('AWAITING_PART');

      // Verify inventory discrepancy was created
      expect(mockTx.inventoryDiscrepancy.create).toHaveBeenCalledWith({
        data: {
          workOrderId: WORK_ORDER_ID,
          sparePartId: SPARE_PART_ID,
          reportedBy: USER_ID,
          quantity: 2,
          reason: 'Part not found on shelf',
        },
      });

      // Verify response shape
      expect(result).toEqual({
        id: WORK_ORDER_ID,
        status: 'EN_ESPERA_DE_REPUESTO',
        missingPartId: SPARE_PART_ID,
        quantity: 2,
        reason: 'Part not found on shelf',
        createdAt,
      });
    });

    it('rolls back all changes if the discrepancy creation fails', async () => {
      const mockTx = {
        workOrder: { update: jest.fn().mockResolvedValue({}) },
        technicalHistory: { create: jest.fn().mockResolvedValue({}) },
        inventoryDiscrepancy: {
          create: jest.fn().mockRejectedValue(new Error('FK violation')),
        },
      };

      prisma.$transaction.mockImplementation(async (fn: (tx: typeof mockTx) => Promise<unknown>) => {
        return fn(mockTx);
      });

      await expect(
        repository.setAwaitingPart(WORK_ORDER_ID, dto, USER_ID, VEHICLE_ID),
      ).rejects.toThrow('FK violation');

      // The transaction should have been attempted
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });
});

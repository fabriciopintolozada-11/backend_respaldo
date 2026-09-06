import { UnprocessableEntityException } from '@nestjs/common';
import { SparePartRepository } from '../src/modules/spare-parts/repositories/spare-part.repository';
import { CreateInventoryAdjustmentDto, InventoryAdjustmentType } from '../src/modules/spare-parts/dto/create-inventory-adjustment.dto';

const SPARE_PART_ID = 'a1b2c3d4-e5f6-4890-abcd-ef1234567890';
const USER_ID = 'b2c3d4e5-f6a7-4901-bcde-f12345678901';
const DISCREPANCY_ID = 'c3d4e5f6-a7b8-4012-bdef-123456789012';

const basePart = {
  id: SPARE_PART_ID,
  code: 'REP-001',
  name: 'Pastilla de freno',
  category: 'FRENOS',
  unitPrice: { toString: () => '120.00' },
  physicalStock: 10,
  reservedStock: 2,
  isActive: true,
  lastMovementAt: new Date('2026-09-01T00:00:00Z'),
};

const makeTx = (overrides: Record<string, unknown> = {}) => {
  const tx = {
    sparePart: {
      findUnique: jest.fn().mockResolvedValue({ ...basePart }),
      update: jest.fn().mockResolvedValue({
        ...basePart,
        physicalStock: 15,
        lastMovementAt: new Date('2026-09-04T12:00:00Z'),
      }),
    },
    stockMovement: { create: jest.fn().mockResolvedValue(undefined) },
    inventoryDiscrepancy: {
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue(undefined),
    },
    ...overrides,
  };
  return tx;
};

const makeRepository = (tx: ReturnType<typeof makeTx>) => {
  const prisma = {
    $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)),
  };
  return { repository: new SparePartRepository(prisma as never), prisma };
};

describe('SparePartRepository.createAdjustment (US-14)', () => {
  const positiveDto: CreateInventoryAdjustmentDto = {
    sparePartId: SPARE_PART_ID,
    quantity: 5,
    type: InventoryAdjustmentType.POSITIVE,
    reason: 'Physical count found 5 extra units on shelf B-03',
  };

  const negativeDto: CreateInventoryAdjustmentDto = {
    sparePartId: SPARE_PART_ID,
    quantity: 3,
    type: InventoryAdjustmentType.NEGATIVE,
    reason: 'Removing 3 damaged units from shelf A-01',
  };

  beforeEach(() => jest.clearAllMocks());

  describe('positive adjustment', () => {
    it('increments physicalStock and records the kardex (RN-08, BE-17)', async () => {
      const tx = makeTx();
      const { repository } = makeRepository(tx);

      const result = await repository.createAdjustment(SPARE_PART_ID, positiveDto, USER_ID);

      expect(tx.sparePart.findUnique).toHaveBeenCalledWith({ where: { id: SPARE_PART_ID } });
      expect(tx.sparePart.update).toHaveBeenCalledWith({
        where: { id: SPARE_PART_ID },
        data: { physicalStock: 15, lastMovementAt: expect.any(Date) },
        select: expect.any(Object),
      });
      expect(tx.stockMovement.create).toHaveBeenCalledWith({
        data: {
          sparePartId: SPARE_PART_ID,
          userId: USER_ID,
          quantity: 5,
          type: 'ADJUSTMENT',
          reason: positiveDto.reason,
          previousPhysicalStock: 10,
          newPhysicalStock: 15,
        },
      });
      expect(result.physicalStock).toBe(15);
      expect(result.code).toBe('REP-001');
    });
  });

  describe('negative adjustment', () => {
    it('decrements physicalStock and records the kardex', async () => {
      const tx = makeTx();
      tx.sparePart.update.mockResolvedValue({
        ...basePart,
        physicalStock: 7,
        lastMovementAt: new Date('2026-09-04T12:00:00Z'),
      });
      const { repository } = makeRepository(tx);

      const result = await repository.createAdjustment(SPARE_PART_ID, negativeDto, USER_ID);

      expect(tx.sparePart.update).toHaveBeenCalledWith({
        where: { id: SPARE_PART_ID },
        data: { physicalStock: 7, lastMovementAt: expect.any(Date) },
        select: expect.any(Object),
      });
      expect(tx.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ previousPhysicalStock: 10, newPhysicalStock: 7 }) }),
      );
      expect(result.physicalStock).toBe(7);
    });
  });

  describe('stock validation guards', () => {
    it('rejects when negative adjustment would drop physicalStock below zero', async () => {
      const tx = makeTx();
      // physicalStock=10, trying to remove 15
      const dto: CreateInventoryAdjustmentDto = {
        sparePartId: SPARE_PART_ID,
        quantity: 15,
        type: InventoryAdjustmentType.NEGATIVE,
        reason: 'Removing more than available stock',
      };
      const { repository } = makeRepository(tx);

      await expect(repository.createAdjustment(SPARE_PART_ID, dto, USER_ID)).rejects.toThrow(
        UnprocessableEntityException,
      );
      expect(tx.sparePart.update).not.toHaveBeenCalled();
      expect(tx.stockMovement.create).not.toHaveBeenCalled();
    });

    it('rejects when negative adjustment would drop physicalStock below reservedStock (RN-07)', async () => {
      const tx = makeTx();
      // physicalStock=10, reservedStock=2, trying to remove 10 → newPhysical=0 < reservedStock=2
      const dto: CreateInventoryAdjustmentDto = {
        sparePartId: SPARE_PART_ID,
        quantity: 10,
        type: InventoryAdjustmentType.NEGATIVE,
        reason: 'Removing all available stock ignoring reservations',
      };
      const { repository } = makeRepository(tx);

      await expect(repository.createAdjustment(SPARE_PART_ID, dto, USER_ID)).rejects.toThrow(
        UnprocessableEntityException,
      );
      expect(tx.sparePart.update).not.toHaveBeenCalled();
    });

    it('rejects when spare part is not found', async () => {
      const tx = makeTx();
      tx.sparePart.findUnique.mockResolvedValue(null);
      const { repository } = makeRepository(tx);

      await expect(repository.createAdjustment(SPARE_PART_ID, positiveDto, USER_ID)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });
  });

  describe('US-13 discrepancy resolution', () => {
    it('resolves the discrepancy within the same transaction when inventoryDiscrepancyId is provided', async () => {
      const tx = makeTx();
      tx.inventoryDiscrepancy.findUnique.mockResolvedValue({
        id: DISCREPANCY_ID,
        sparePartId: SPARE_PART_ID,
        status: 'PENDING',
      });
      const dto: CreateInventoryAdjustmentDto = {
        ...positiveDto,
        inventoryDiscrepancyId: DISCREPANCY_ID,
      };
      const { repository } = makeRepository(tx);

      await repository.createAdjustment(SPARE_PART_ID, dto, USER_ID);

      expect(tx.inventoryDiscrepancy.findUnique).toHaveBeenCalledWith({ where: { id: DISCREPANCY_ID } });
      expect(tx.inventoryDiscrepancy.update).toHaveBeenCalledWith({
        where: { id: DISCREPANCY_ID },
        data: { status: 'RESOLVED', resolvedBy: USER_ID, resolvedAt: expect.any(Date) },
      });
    });

    it('rejects when discrepancy does not belong to the same spare part', async () => {
      const tx = makeTx();
      tx.inventoryDiscrepancy.findUnique.mockResolvedValue({
        id: DISCREPANCY_ID,
        sparePartId: 'different-spare-part-id',
        status: 'PENDING',
      });
      const dto: CreateInventoryAdjustmentDto = {
        ...positiveDto,
        inventoryDiscrepancyId: DISCREPANCY_ID,
      };
      const { repository } = makeRepository(tx);

      await expect(repository.createAdjustment(SPARE_PART_ID, dto, USER_ID)).rejects.toThrow(
        UnprocessableEntityException,
      );
      expect(tx.inventoryDiscrepancy.update).not.toHaveBeenCalled();
    });

    it('rejects when discrepancy is already resolved', async () => {
      const tx = makeTx();
      tx.inventoryDiscrepancy.findUnique.mockResolvedValue({
        id: DISCREPANCY_ID,
        sparePartId: SPARE_PART_ID,
        status: 'RESOLVED',
      });
      const dto: CreateInventoryAdjustmentDto = {
        ...positiveDto,
        inventoryDiscrepancyId: DISCREPANCY_ID,
      };
      const { repository } = makeRepository(tx);

      await expect(repository.createAdjustment(SPARE_PART_ID, dto, USER_ID)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('rejects when discrepancy does not exist', async () => {
      const tx = makeTx();
      tx.inventoryDiscrepancy.findUnique.mockResolvedValue(null);
      const dto: CreateInventoryAdjustmentDto = {
        ...positiveDto,
        inventoryDiscrepancyId: DISCREPANCY_ID,
      };
      const { repository } = makeRepository(tx);

      await expect(repository.createAdjustment(SPARE_PART_ID, dto, USER_ID)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('skips discrepancy resolution when inventoryDiscrepancyId is not provided', async () => {
      const tx = makeTx();
      const { repository } = makeRepository(tx);

      await repository.createAdjustment(SPARE_PART_ID, positiveDto, USER_ID);

      expect(tx.inventoryDiscrepancy.findUnique).not.toHaveBeenCalled();
      expect(tx.inventoryDiscrepancy.update).not.toHaveBeenCalled();
    });
  });

  describe('reservedStock is never modified', () => {
    it('keeps reservedStock unchanged after a positive adjustment', async () => {
      const tx = makeTx();
      const { repository } = makeRepository(tx);

      const result = await repository.createAdjustment(SPARE_PART_ID, positiveDto, USER_ID);

      expect(result.reservedStock).toBe(2);
    });

    it('keeps reservedStock unchanged after a negative adjustment', async () => {
      const tx = makeTx();
      tx.sparePart.update.mockResolvedValue({
        ...basePart,
        physicalStock: 7,
        lastMovementAt: new Date('2026-09-04T12:00:00Z'),
      });
      const { repository } = makeRepository(tx);

      const result = await repository.createAdjustment(SPARE_PART_ID, negativeDto, USER_ID);

      expect(result.reservedStock).toBe(2);
    });
  });
});

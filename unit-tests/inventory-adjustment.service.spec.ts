import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { validate } from 'class-validator';
import { SparePartsService } from '../src/modules/spare-parts/spare-parts.service';
import { SparePartRepository } from '../src/modules/spare-parts/repositories/spare-part.repository';
import { CreateInventoryAdjustmentDto, InventoryAdjustmentType } from '../src/modules/spare-parts/dto/create-inventory-adjustment.dto';
import { UserRole } from '../src/common/enums/user-role.enum';

const SPARE_PART_ID = 'a1b2c3d4-e5f6-4890-abcd-ef1234567890';
const USER_ID = 'b2c3d4e5-f6a7-4901-bcde-f12345678901';
const DISCREPANCY_ID = 'c3d4e5f6-a7b8-4012-bdef-123456789012';

const existingPart = {
  id: SPARE_PART_ID,
  code: 'REP-001',
  name: 'Pastilla de freno',
  category: 'FRENOS',
  unitPrice: { toString: () => '120.00' },
  physicalStock: 10,
  availableStock: 10,
  reservedStock: 0,
  isActive: true,
  lastMovementAt: new Date('2026-09-01T00:00:00Z'),
};

const adjustedPart = {
  ...existingPart,
  physicalStock: 15,
  lastMovementAt: new Date('2026-09-04T12:00:00Z'),
};

describe('SparePartsService.createAdjustment (US-14)', () => {
  let service: SparePartsService;
  const repository = {
    findById: jest.fn(),
    createAdjustment: jest.fn(),
  } as unknown as jest.Mocked<SparePartRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SparePartsService(repository);
  });

  const baseDto: CreateInventoryAdjustmentDto = {
    sparePartId: SPARE_PART_ID,
    quantity: 5,
    type: InventoryAdjustmentType.POSITIVE,
    reason: 'Physical count found 5 extra units on shelf B-03',
  };

  describe('successful adjustments', () => {
    it('delegates to the repository and returns the updated part', async () => {
      repository.findById.mockResolvedValue(existingPart as never);
      repository.createAdjustment.mockResolvedValue({
        ...adjustedPart,
        unitPrice: '120.00',
      } as never);

      const result = await service.createAdjustment(baseDto, USER_ID, UserRole.WORKSHOP_LEAD);

      expect(repository.findById).toHaveBeenCalledWith(SPARE_PART_ID);
      expect(repository.createAdjustment).toHaveBeenCalledWith(SPARE_PART_ID, baseDto, USER_ID);
      expect(result.physicalStock).toBe(15);
    });

    it('allows WORKSHOP_LEAD to perform adjustments (RN-14)', async () => {
      repository.findById.mockResolvedValue(existingPart as never);
      repository.createAdjustment.mockResolvedValue(adjustedPart as never);

      await expect(service.createAdjustment(baseDto, USER_ID, UserRole.WORKSHOP_LEAD)).resolves.toBeDefined();
    });

    it('allows ADMIN to perform adjustments', async () => {
      repository.findById.mockResolvedValue(existingPart as never);
      repository.createAdjustment.mockResolvedValue(adjustedPart as never);

      await expect(service.createAdjustment(baseDto, USER_ID, UserRole.ADMIN)).resolves.toBeDefined();
    });

    it('passes the discrepancy ID to the repository when provided', async () => {
      repository.findById.mockResolvedValue(existingPart as never);
      repository.createAdjustment.mockResolvedValue(adjustedPart as never);
      const dtoWithDiscrepancy = { ...baseDto, inventoryDiscrepancyId: DISCREPANCY_ID };

      await service.createAdjustment(dtoWithDiscrepancy, USER_ID, UserRole.WORKSHOP_LEAD);

      expect(repository.createAdjustment).toHaveBeenCalledWith(SPARE_PART_ID, dtoWithDiscrepancy, USER_ID);
    });
  });

  describe('validation failures', () => {
    it('throws NotFoundException when the spare part does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.createAdjustment({ ...baseDto, sparePartId: 'nonexistent-uuid' }, USER_ID, UserRole.WORKSHOP_LEAD),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repository.createAdjustment).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the spare part is inactive', async () => {
      repository.findById.mockResolvedValue(null); // findById filters isActive: true

      await expect(
        service.createAdjustment(baseDto, USER_ID, UserRole.WORKSHOP_LEAD),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});

describe('CreateInventoryAdjustmentDto validation (US-14)', () => {
  function buildDto(overrides: Partial<CreateInventoryAdjustmentDto>): CreateInventoryAdjustmentDto {
    const dto = new CreateInventoryAdjustmentDto();
    dto.sparePartId = overrides.sparePartId ?? SPARE_PART_ID;
    dto.quantity = overrides.quantity ?? 5;
    dto.type = overrides.type ?? InventoryAdjustmentType.POSITIVE;
    dto.reason = overrides.reason ?? 'Valid reason with enough characters';
    if (overrides.inventoryDiscrepancyId) dto.inventoryDiscrepancyId = overrides.inventoryDiscrepancyId;
    return dto;
  }

  it('rejects a payload with quantity below 1', async () => {
    const dto = buildDto({ quantity: 0 });
    const errors = await validate(dto);
    expect(errors.map((e) => e.property)).toContain('quantity');
  });

  it('rejects a payload with reason shorter than 10 characters', async () => {
    const dto = buildDto({ reason: 'Short' });
    const errors = await validate(dto);
    expect(errors.map((e) => e.property)).toContain('reason');
  });

  it('rejects an invalid adjustment type', async () => {
    const dto = buildDto({ type: 'INVALID' as InventoryAdjustmentType });
    const errors = await validate(dto);
    expect(errors.map((e) => e.property)).toContain('type');
  });

  it('rejects a non-UUID sparePartId', async () => {
    const dto = buildDto({ sparePartId: 'not-a-uuid' });
    const errors = await validate(dto);
    expect(errors.map((e) => e.property)).toContain('sparePartId');
  });

  it('accepts a valid payload without optional discrepancy ID', async () => {
    const dto = buildDto({ type: InventoryAdjustmentType.NEGATIVE, reason: 'Reason with more than ten chars' });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('accepts a valid payload with optional discrepancy ID', async () => {
    const dto = buildDto({
      type: InventoryAdjustmentType.POSITIVE,
      reason: 'Resolving US-13 discrepancy for missing part',
      inventoryDiscrepancyId: DISCREPANCY_ID,
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });
});

import { ConflictException, NotFoundException } from '@nestjs/common';
import { validate } from 'class-validator';
import { UserRole } from '../src/common/enums/user-role.enum';
import { CreateSparePartDto } from '../src/modules/spare-parts/dto/create-spare-part.dto';
import { QuerySparePartsDto } from '../src/modules/spare-parts/dto/query-spare-parts.dto';
import { SparePartCategory } from '../src/modules/spare-parts/dto/spare-part-category.enum';
import { SparePartsService } from '../src/modules/spare-parts/spare-parts.service';

const part = {
  id: 'part-1',
  code: 'REP-001',
  name: 'Pastilla de freno',
  category: SparePartCategory.FRENOS,
  unitPrice: { toString: () => '120.00' },
  physicalStock: 10,
  availableStock: 10,
  reservedStock: 0,
  isActive: true,
  lastMovementAt: new Date('2026-09-01T00:00:00Z'),
};

describe('SparePartsService', () => {
  const repository = {
    findAll: jest.fn(),
    count: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    findForDeactivation: jest.fn(),
    deactivate: jest.fn(),
  };
  let service: SparePartsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SparePartsService(repository as never);
  });

  it('returns a paginated catalog and filters by role at the response boundary', async () => {
    repository.findAll.mockResolvedValue([part]);
    repository.count.mockResolvedValue(1);

    await expect(service.findAll({ search: 'freno', page: 2, pageSize: 10 }, UserRole.MECHANIC)).resolves.toEqual({
      data: [{ id: 'part-1', code: 'REP-001', name: 'Pastilla de freno', category: SparePartCategory.FRENOS, physicalStock: 10, availableStock: 10, reservedStock: 0, lastMovementAt: part.lastMovementAt, isActive: true }],
      total: 1,
      page: 2,
      pageSize: 10,
    });
    expect(repository.findAll).toHaveBeenCalledWith({ search: 'freno', page: 2, pageSize: 10 });
  });

  it('includes the official price for an authorized catalog role', async () => {
    repository.findById.mockResolvedValue(part);

    await expect(service.findById('part-1', UserRole.WORKSHOP_LEAD)).resolves.toMatchObject({ unitPrice: '120.00' });
  });

  it('creates a catalog item through the repository transaction', async () => {
    repository.create.mockResolvedValue(part);
    const dto = { code: 'rep-001', name: 'Pastilla de freno', category: SparePartCategory.FRENOS, unitPrice: 120, initialStock: 10 };

    await service.create(dto, 'admin-1');

    expect(repository.create).toHaveBeenCalledWith(dto, 'admin-1');
  });

  it('rejects deactivation when reservations are pending', async () => {
    repository.findForDeactivation.mockResolvedValue({ id: 'part-1', reservedStock: 1, quoteItems: [{ id: 'quote-part-1' }] });

    await expect(service.deactivate('part-1')).rejects.toBeInstanceOf(ConflictException);
    expect(repository.deactivate).not.toHaveBeenCalled();
  });

  it('returns not found when deactivating an unknown item', async () => {
    repository.findForDeactivation.mockResolvedValue(null);

    await expect(service.deactivate('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('Spare part DTO validation', () => {
  it('rejects invalid category and negative stock', async () => {
    const dto = Object.assign(new CreateSparePartDto(), { code: 'A', name: 'Part', category: 'INVALID', unitPrice: 1, initialStock: -1 });
    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toEqual(expect.arrayContaining(['category', 'initialStock']));
  });

  it('rejects invalid pagination values', async () => {
    const dto = Object.assign(new QuerySparePartsDto(), { page: 0, pageSize: 101 });
    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toEqual(expect.arrayContaining(['page', 'pageSize']));
  });
});

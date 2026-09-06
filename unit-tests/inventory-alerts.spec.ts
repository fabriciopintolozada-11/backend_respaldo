import { validate } from 'class-validator';
import { SparePartCategory } from '../src/modules/spare-parts/dto/spare-part-category.enum';
import { InventoryAlertType } from '../src/modules/spare-parts/dto/inventory-alert-type.enum';
import { QueryInventoryAlertsDto } from '../src/modules/spare-parts/dto/query-inventory-alerts.dto';
import { SparePartsService } from '../src/modules/spare-parts/spare-parts.service';

const stalePart = {
  id: 'part-1',
  code: 'REP-FRE-001',
  name: 'Pastilla de freno',
  category: SparePartCategory.FRENOS,
  physicalStock: 4,
  reservedStock: 0,
  lastMovementAt: new Date('2026-07-01T00:00:00.000Z'),
};

describe('Inventory alerts', () => {
  it('returns a no-rotation alert with days calculated from the real movement date', async () => {
    const repository = { findInventoryAlerts: jest.fn().mockResolvedValue({ data: [stalePart], total: 1 }) };
    const service = new SparePartsService(repository as never);

    const result = await service.findAlerts({ alertType: InventoryAlertType.NO_ROTATION, page: 1, pageSize: 20 });

    expect(result).toMatchObject({ total: 1, page: 1, pageSize: 20 });
    expect(result.data[0]).toMatchObject({
      partId: stalePart.id,
      alertType: InventoryAlertType.NO_ROTATION,
      physicalStock: 4,
      availableStock: 4,
      daysWithoutMovement: expect.any(Number),
    });
  });

  it('calculates critical availability from physical and reserved stock', async () => {
    const repository = {
      findInventoryAlerts: jest.fn().mockResolvedValue({
        data: [{ ...stalePart, physicalStock: 2, reservedStock: 2, lastMovementAt: new Date() }],
        total: 1,
      }),
    };
    const service = new SparePartsService(repository as never);

    const result = await service.findAlerts({ alertType: InventoryAlertType.STOCK_OUT });

    expect(result.data[0]).toMatchObject({
      alertType: InventoryAlertType.STOCK_OUT,
      availableStock: 0,
      physicalStock: 2,
      reservedStock: 2,
    });
  });

  it('passes search, category and pagination filters to the repository', async () => {
    const repository = { findInventoryAlerts: jest.fn().mockResolvedValue({ data: [], total: 0 }) };
    const service = new SparePartsService(repository as never);
    const query = { search: 'freno', category: SparePartCategory.FRENOS, page: 2, pageSize: 10 };

    await service.findAlerts(query);

    expect(repository.findInventoryAlerts).toHaveBeenCalledWith(query, expect.any(Date));
  });
});

describe('QueryInventoryAlertsDto validation', () => {
  it('rejects unsupported alert types and invalid pagination', async () => {
    const dto = Object.assign(new QueryInventoryAlertsDto(), {
      alertType: 'LOW_STOCK',
      page: 0,
      pageSize: 101,
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(expect.arrayContaining(['alertType', 'page', 'pageSize']));
  });
});

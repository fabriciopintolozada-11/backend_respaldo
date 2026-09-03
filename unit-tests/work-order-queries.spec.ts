import { WorkOrdersService } from '../src/modules/work-orders/work-orders.service';
import { QueryWorkOrdersDto } from '../src/modules/work-orders/dto/query-work-orders.dto';
import { validate } from 'class-validator';

describe('WorkOrdersService HU-04 queries', () => {
  const repository = {
    findAvailable: jest.fn(),
    countAvailable: jest.fn(),
    findActiveMechanics: jest.fn(),
    countActiveMechanics: jest.fn(),
  };
  let service: WorkOrdersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WorkOrdersService(repository as never);
  });

  it('returns paginated work orders available for assignment', async () => {
    const row = {
      id: 'work-order-1',
      vehicleId: 'vehicle-1',
      plate: 'ABC-123',
      vehicleBrand: 'Toyota',
      vehicleModel: 'Corolla',
      vehicleYear: 2024,
      customerName: 'Customer One',
      customerIdentification: 'ID-1',
      initialComplaint: 'Engine noise',
      status: 'RECIBIDO',
      createdAt: new Date('2026-08-20T10:00:00Z'),
      mechanicId: null,
    };
    repository.findAvailable.mockResolvedValue([row]);
    repository.countAvailable.mockResolvedValue(1);

    await expect(service.getAvailableWorkOrders({ page: 2, pageSize: 10 })).resolves.toEqual({
      data: [row],
      total: 1,
      page: 2,
      pageSize: 10,
    });
    expect(repository.findAvailable).toHaveBeenCalledWith(2, 10);
    expect(repository.countAvailable).toHaveBeenCalledTimes(1);
  });

  it('uses safe pagination defaults for available work orders', async () => {
    repository.findAvailable.mockResolvedValue([]);
    repository.countAvailable.mockResolvedValue(0);

    await expect(service.getAvailableWorkOrders({})).resolves.toEqual({
      data: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });
    expect(repository.findAvailable).toHaveBeenCalledWith(1, 20);
  });

  it('returns only active mechanics in the paginated assignment catalog', async () => {
    const mechanics = [{ id: 'mechanic-1', isActive: true }];
    repository.findActiveMechanics.mockResolvedValue(mechanics);
    repository.countActiveMechanics.mockResolvedValue(1);

    await expect(service.getActiveMechanics({})).resolves.toEqual({
      data: mechanics,
      total: 1,
      page: 1,
      pageSize: 20,
    });
    expect(repository.findActiveMechanics).toHaveBeenCalledWith(1, 20);
  });

  it('keeps repository errors visible to the HTTP filter', async () => {
    const failure = new Error('database unavailable');
    repository.findAvailable.mockRejectedValue(failure);
    repository.countAvailable.mockResolvedValue(0);

    await expect(service.getAvailableWorkOrders({})).rejects.toBe(failure);
  });
});

describe('QueryWorkOrdersDto', () => {
  it('accepts integer pagination values', () => {
    const query = new QueryWorkOrdersDto();
    query.page = 1;
    query.pageSize = 100;
    expect(query).toMatchObject({ page: 1, pageSize: 100 });
  });

  it('rejects pagination values outside the supported range', async () => {
    const query = new QueryWorkOrdersDto();
    query.page = 0;
    query.pageSize = 101;

    const errors = await validate(query);

    expect(errors.map((error) => error.property)).toEqual(expect.arrayContaining(['page', 'pageSize']));
  });
});

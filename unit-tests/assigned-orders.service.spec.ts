import { Test, TestingModule } from '@nestjs/testing';
import { AssignedOrdersService } from '../src/modules/work-orders/assigned-orders.service';
import { MechanicOrdersRepository } from '../src/modules/work-orders/repositories/mechanic-orders.repository';

describe('AssignedOrdersService (US-03)', () => {
  let service: AssignedOrdersService;
  const repository = {
    findAssignedToMechanic: jest.fn(),
    findAssignedDetail: jest.fn(),
    countAssignedToMechanic: jest.fn(),
  };

  const assignedRow = {
    id: 'wo-1',
    vehicleId: 'v-1',
    status: 'EN_REPARACION',
    initialComplaint: 'No arranca',
    assignedAt: new Date('2026-08-02T10:00:00Z'),
    vehicle: { plate: '1234ABC' },
    quote: null,
  };

  const approvedQuote = {
    id: 'quote-1',
    approvals: [{ decision: 'APPROVED' }],
    parts: [
      {
        id: 'quote-part-1',
        sparePartId: 'spare-1',
        quantity: 2,
        status: 'RESERVED',
        sparePart: { id: 'spare-1', code: 'FRE-001', name: 'Pastillas de freno' },
      },
    ],
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssignedOrdersService,
        { provide: MechanicOrdersRepository, useValue: repository },
      ],
    }).compile();
    service = module.get(AssignedOrdersService);
  });

  it('returns only the work orders assigned to the given mechanic (RN-04, US-03)', async () => {
    repository.findAssignedToMechanic.mockResolvedValue([assignedRow]);
    repository.countAssignedToMechanic.mockResolvedValue(1);

    const result = await service.getAssigned('mechanic-1', { page: 1, pageSize: 20 });

    expect(repository.findAssignedToMechanic).toHaveBeenCalledWith('mechanic-1', 1, 20);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].plate).toBe('1234ABC');
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
  });

  it('never exposes cost or price fields to the mechanic (RN-16, BE-12, US-03)', async () => {
    repository.findAssignedToMechanic.mockResolvedValue([assignedRow]);
    repository.countAssignedToMechanic.mockResolvedValue(1);

    const result = await service.getAssigned('mechanic-1', {});

    expect(result.data[0]).not.toHaveProperty('price');
    expect(result.data[0]).not.toHaveProperty('cost');
    expect(JSON.stringify(result)).not.toMatch(/price|cost|totalAmount|rate/i);
  });

  it('uses default pagination when no page parameters are provided (BE-24)', async () => {
    repository.findAssignedToMechanic.mockResolvedValue([]);
    repository.countAssignedToMechanic.mockResolvedValue(0);

    const result = await service.getAssigned('mechanic-1', {});

    expect(repository.findAssignedToMechanic).toHaveBeenCalledWith('mechanic-1', 1, 20);
    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('exposes the approved quote parts so the modal can read missingPartId (HU-13)', async () => {
    repository.findAssignedToMechanic.mockResolvedValue([{ ...assignedRow, quote: approvedQuote }]);
    repository.countAssignedToMechanic.mockResolvedValue(1);

    const result = await service.getAssigned('mechanic-1', {});

    expect(result.data[0].quote).toEqual({
      id: 'quote-1',
      parts: [
        {
          id: 'quote-part-1',
          sparePartId: 'spare-1',
          quantity: 2,
          status: 'RESERVED',
          sparePart: { id: 'spare-1', code: 'FRE-001', name: 'Pastillas de freno' },
        },
      ],
    });
  });

  it('hides the quote when it has not been approved by the customer (HU-13)', async () => {
    repository.findAssignedToMechanic.mockResolvedValue([
      { ...assignedRow, quote: { id: 'quote-1', approvals: [{ decision: 'REJECTED' }], parts: [] } },
    ]);
    repository.countAssignedToMechanic.mockResolvedValue(1);

    const result = await service.getAssigned('mechanic-1', {});

    expect(result.data[0].quote).toBeNull();
  });

  it('exposes the approved quote on the detail endpoint (HU-13)', async () => {
    repository.findAssignedDetail.mockResolvedValue({
      ...assignedRow,
      vehicle: { plate: '1234ABC', brand: 'Toyota', model: 'Corolla', year: 2020 },
      quote: approvedQuote,
    });

    const detail = await service.getAssignedDetail('mechanic-1', 'wo-1');

    expect(detail.quote).toEqual({
      id: 'quote-1',
      parts: [
        {
          id: 'quote-part-1',
          sparePartId: 'spare-1',
          quantity: 2,
          status: 'RESERVED',
          sparePart: { id: 'spare-1', code: 'FRE-001', name: 'Pastillas de freno' },
        },
      ],
    });
    expect(JSON.stringify(detail)).not.toMatch(/price|cost|amount|rate/i);
  });

  it('never exposes cost, price or subtotal of the quote parts (RN-16)', async () => {
    repository.findAssignedToMechanic.mockResolvedValue([{ ...assignedRow, quote: approvedQuote }]);
    repository.countAssignedToMechanic.mockResolvedValue(1);

    const result = await service.getAssigned('mechanic-1', {});

    expect(JSON.stringify(result)).not.toMatch(/price|cost|totalAmount|rate|subtotal|partsSubtotal|unitPrice/i);
  });
});

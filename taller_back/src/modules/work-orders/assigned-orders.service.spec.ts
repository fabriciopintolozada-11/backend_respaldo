import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AssignedOrdersService } from './assigned-orders.service';
import { MechanicOrdersRepository } from './repositories/mechanic-orders.repository';

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
  };

  const assignedDetailRow = {
    id: 'wo-1',
    vehicleId: 'v-1',
    status: 'EN_REPARACION',
    initialComplaint: 'No arranca',
    assignedAt: new Date('2026-08-02T10:00:00Z'),
    vehicle: { plate: '1234ABC', brand: 'Toyota', model: 'Corolla', year: 2019 },
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

  it('returns the technical detail of an assigned work order (US-03)', async () => {
    repository.findAssignedDetail.mockResolvedValue(assignedDetailRow);

    const result = await service.getAssignedDetail('mechanic-1', 'wo-1');

    expect(repository.findAssignedDetail).toHaveBeenCalledWith('mechanic-1', 'wo-1');
    expect(result.plate).toBe('1234ABC');
    expect(result.brand).toBe('Toyota');
    expect(result.model).toBe('Corolla');
    expect(result.status).toBe('EN_REPARACION');
  });

  it('returns 404 when the work order is not assigned to the requesting mechanic (RN-04)', async () => {
    repository.findAssignedDetail.mockResolvedValue(null);

    await expect(service.getAssignedDetail('mechanic-1', 'wo-other')).rejects.toThrow(NotFoundException);
    expect(repository.findAssignedDetail).toHaveBeenCalledWith('mechanic-1', 'wo-other');
  });

  it('never exposes cost or price fields in the detail response (RN-16, BE-12)', async () => {
    repository.findAssignedDetail.mockResolvedValue(assignedDetailRow);

    const result = await service.getAssignedDetail('mechanic-1', 'wo-1');

    expect(JSON.stringify(result)).not.toMatch(/price|cost|amount|rate/i);
  });
});

import { NotFoundException } from '@nestjs/common';
import { Prisma } from '../src/generated/prisma/client';
import { VehiclesService } from '../src/modules/vehicles/vehicles.service';
import { VehicleRepository } from '../src/modules/vehicles/repositories/vehicle.repository';

describe('VehiclesService.getVehicleHistory (US-05 / BE-T05.3)', () => {
  const repository = {
    findVehicleHistory: jest.fn(),
  };
  let service: VehiclesService;

  const vehicleRow = {
    id: 'v-1',
    plate: '4589-KXA',
    brand: 'Toyota',
    model: 'Hilux',
    year: 2022,
    isFullyElectric: false,
    customerId: 'c-1',
    customer: { id: 'c-1', identification: 'CI-1000000', name: 'Juan Pérez', phone: '710000000' },
    technicalHistory: [
      { id: 'th-1', description: 'Mantenimiento preventivo', createdAt: new Date('2026-08-01T10:00:00Z') },
    ],
    workOrders: [
      {
        id: 'wo-1',
        status: 'DELIVERED',
        createdAt: new Date('2026-07-10T08:00:00Z'),
        diagnostic: {
          id: 'd-1',
          description: 'Desgaste de pastillas',
          suggestedTasks: ['Reemplazar pastillas delanteras'],
          estimatedHours: new Prisma.Decimal('2.5'),
          createdAt: new Date('2026-07-11T09:00:00Z'),
        },
        stockMovements: [
          {
            quantity: 2,
            createdAt: new Date('2026-07-12T10:00:00Z'),
            sparePart: { id: 'sp-1', code: 'REP-FRE-001', name: 'Pastillas de Freno' },
          },
          {
            quantity: 1,
            createdAt: new Date('2026-07-13T11:00:00Z'),
            sparePart: { id: 'sp-1', code: 'REP-FRE-001', name: 'Pastillas de Freno' },
          },
        ],
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new VehiclesService(repository as unknown as VehicleRepository);
  });

  it('throws 404 when the vehicle does not exist', async () => {
    repository.findVehicleHistory.mockResolvedValue(null);

    await expect(service.getVehicleHistory('ZZZ-999')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('normalizes the plate before querying', async () => {
    repository.findVehicleHistory.mockResolvedValue({ ...vehicleRow, plate: '4589-KXA' });

    await service.getVehicleHistory(' 4589-kxa ');

    expect(repository.findVehicleHistory).toHaveBeenCalledWith('4589-KXA');
  });

  it('keeps the vehicle, customer and immutable technical history on the response', async () => {
    repository.findVehicleHistory.mockResolvedValue(vehicleRow);

    const result = await service.getVehicleHistory('4589-KXA');

    expect(result).toMatchObject({
      id: 'v-1',
      plate: '4589-KXA',
      brand: 'Toyota',
      model: 'Hilux',
      year: 2022,
      isFullyElectric: false,
      customerId: 'c-1',
      customer: { id: 'c-1', identification: 'CI-1000000', name: 'Juan Pérez', phone: '710000000' },
    });
    expect(result.technicalHistory).toEqual([
      { id: 'th-1', description: 'Mantenimiento preventivo', createdAt: new Date('2026-08-01T10:00:00Z') },
    ]);
  });

  it('aggregates consumed parts per spare part keeping the immutable date', async () => {
    repository.findVehicleHistory.mockResolvedValue(vehicleRow);

    const result = await service.getVehicleHistory('4589-KXA');

    expect(result.workOrders[0].consumedParts).toEqual([
      {
        sparePartId: 'sp-1',
        code: 'REP-FRE-001',
        name: 'Pastillas de Freno',
        quantity: 3,
        createdAt: new Date('2026-07-12T10:00:00Z'),
      },
    ]);
  });

  it('serializes the diagnostic as a non-financial allowlist', async () => {
    repository.findVehicleHistory.mockResolvedValue(vehicleRow);

    const result = await service.getVehicleHistory('4589-KXA');

    const diagnostic = result.workOrders[0].diagnostic;
    expect(diagnostic).toEqual({
      id: 'd-1',
      description: 'Desgaste de pastillas',
      suggestedTasks: ['Reemplazar pastillas delanteras'],
      estimatedHours: 2.5,
      createdAt: new Date('2026-07-11T09:00:00Z'),
    });
    const keys = Object.keys(diagnostic ?? {});
    expect(keys).toEqual(['id', 'description', 'suggestedTasks', 'estimatedHours', 'createdAt']);
    expect(diagnostic).not.toHaveProperty('unitPrice');
    expect(diagnostic).not.toHaveProperty('total');
  });

  it('returns null diagnostic for a work order without one', async () => {
    repository.findVehicleHistory.mockResolvedValue({
      ...vehicleRow,
      workOrders: [{ ...vehicleRow.workOrders[0], diagnostic: null, stockMovements: [] }],
    });

    const result = await service.getVehicleHistory('4589-KXA');

    expect(result.workOrders[0].diagnostic).toBeNull();
    expect(result.workOrders[0].consumedParts).toEqual([]);
  });
});
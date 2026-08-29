import { UnprocessableEntityException } from '@nestjs/common';
import { RegisterVehicleEntryDto } from '../dto/register-vehicle-entry.dto';
import { WorkOrderRepository } from '../repositories/work-order.repository';
import { WorkOrdersService } from '../work-orders.service';

describe('WorkOrdersService (HU-01)', () => {
  const repository = {
    createVehicleEntry: jest.fn(),
    findVehicleHistory: jest.fn(),
  } as unknown as WorkOrderRepository;
  let service: WorkOrdersService;

  const dto: RegisterVehicleEntryDto = {
    plate: 'abc-123',
    customer: { identification: '1234567', name: 'Test Customer', phone: '70000000' },
    vehicle: { brand: 'Test', model: 'Model', year: 2024, isFullyElectric: false },
    initialComplaint: 'Engine check',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WorkOrdersService(repository);
  });

  it('rejects fully electric vehicles with HTTP 422 (RN-18)', () => {
    const electricDto = { ...dto, vehicle: { ...dto.vehicle, isFullyElectric: true } };

    expect(() => service.registerVehicleEntry(electricDto, 'receptionist-id')).toThrow(UnprocessableEntityException);
    expect(repository.createVehicleEntry).not.toHaveBeenCalled();
  });

  it("creates a work order in 'RECIBIDO' state", async () => {
    repository.createVehicleEntry = jest.fn().mockResolvedValue({
      id: 'work-order-id',
      vehicleId: 'vehicle-id',
      customerId: 'customer-id',
      status: 'RECIBIDO',
      initialComplaint: dto.initialComplaint,
      createdAt: new Date(),
    });

    const result = await service.registerVehicleEntry(dto, 'receptionist-id');

    expect(result.status).toBe('RECIBIDO');
    expect(repository.createVehicleEntry).toHaveBeenCalledWith(
      { ...dto, plate: 'ABC-123' },
      'receptionist-id',
    );
  });
});

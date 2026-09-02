import { NotFoundException } from '@nestjs/common';
import { WorkOrderRepository } from '../src/modules/work-orders/repositories/work-order.repository';
import { RegisterVehicleEntryDto } from '../src/modules/work-orders/dto/register-vehicle-entry.dto';

const makeTransaction = () => ({
  customer: { upsert: jest.fn() },
  vehicle: { upsert: jest.fn() },
  workOrder: { create: jest.fn() },
  technicalHistory: { create: jest.fn() },
});

const dto: RegisterVehicleEntryDto = {
  plate: 'ABC-123',
  customer: { identification: '1234567', name: 'New Customer', phone: '70000000' },
  vehicle: { brand: 'Toyota', model: 'Corolla', year: 2024, isFullyElectric: false },
  initialComplaint: 'Engine noise',
};

describe('WorkOrderRepository (HU-01)', () => {
  let repo: WorkOrderRepository;
  let tx: ReturnType<typeof makeTransaction>;

  beforeEach(() => {
    tx = makeTransaction();
    repo = new WorkOrderRepository({
      $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
    } as never);
  });

  it('creates customer, vehicle and work order for a new entry (RN-01)', async () => {
    const customerId = 'new-customer-id';
    const vehicleId = 'new-vehicle-id';
    tx.customer.upsert.mockResolvedValue({ id: customerId });
    tx.vehicle.upsert.mockResolvedValue({ id: vehicleId, customerId });
    tx.workOrder.create.mockResolvedValue({
      id: 'wo-1', vehicleId, customerId, status: 'RECIBIDO', initialComplaint: dto.initialComplaint, createdAt: new Date(),
    });
    tx.technicalHistory.create.mockResolvedValue({});

    const result = await repo.createVehicleEntry(dto, 'receptionist-id');

    expect(tx.customer.upsert).toHaveBeenCalledTimes(1);
    expect(tx.vehicle.upsert).toHaveBeenCalledTimes(1);
    expect(tx.workOrder.create).toHaveBeenCalledWith({
      data: { vehicleId, customerId, receptionistId: 'receptionist-id', initialComplaint: dto.initialComplaint },
      select: { id: true, vehicleId: true, customerId: true, status: true, initialComplaint: true, createdAt: true },
    });
    expect(result.status).toBe('RECIBIDO');
  });

  it('reuses existing vehicle and links work order to original customer (HU-01 Escenario 2)', async () => {
    const originalCustomerId = 'original-customer-id';
    const vehicleId = 'existing-vehicle-id';

    tx.customer.upsert.mockResolvedValue({ id: 'incoming-customer-id' });
    tx.vehicle.upsert.mockResolvedValue({
      id: vehicleId,
      customerId: originalCustomerId,
      plate: 'ABC-123',
    });
    tx.workOrder.create.mockResolvedValue({
      id: 'wo-2', vehicleId, customerId: originalCustomerId, status: 'RECIBIDO', initialComplaint: dto.initialComplaint, createdAt: new Date(),
    });
    tx.technicalHistory.create.mockResolvedValue({});

    const result = await repo.createVehicleEntry(dto, 'receptionist-id');

    expect(result.customerId).toBe(originalCustomerId);
    expect(tx.workOrder.create).toHaveBeenCalledWith({
      data: { vehicleId, customerId: originalCustomerId, receptionistId: 'receptionist-id', initialComplaint: dto.initialComplaint },
      select: { id: true, vehicleId: true, customerId: true, status: true, initialComplaint: true, createdAt: true },
    });
  });

  it('registers initial technical history entry (RN-19)', async () => {
    tx.customer.upsert.mockResolvedValue({ id: 'c1' });
    tx.vehicle.upsert.mockResolvedValue({ id: 'v1', customerId: 'c1' });
    tx.workOrder.create.mockResolvedValue({
      id: 'wo-3', vehicleId: 'v1', customerId: 'c1', status: 'RECIBIDO', initialComplaint: 'Brakes squeaking', createdAt: new Date(),
    });
    tx.technicalHistory.create.mockResolvedValue({});

    await repo.createVehicleEntry(dto, 'receptionist-id');

    expect(tx.technicalHistory.create).toHaveBeenCalledWith({
      data: {
        vehicleId: 'v1',
        description: expect.stringContaining('Initial complaint: Brakes squeaking'),
      },
    });
  });
});

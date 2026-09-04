import { Prisma } from '../src/generated/prisma/client';
import { WorkOrderRepository } from '../src/modules/work-orders/repositories/work-order.repository';
import { RegisterVehicleEntryDto } from '../src/modules/work-orders/dto/register-vehicle-entry.dto';
import { CreateDiagnosticDto } from '../src/modules/work-orders/dto/create-diagnostic.dto';

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

describe('WorkOrderRepository.createDiagnostic (HU-11)', () => {
  const workOrderId = 'aaaa0000-0000-4000-8000-000000000001';
  const vehicleId = 'bbbb0000-0000-4000-8000-000000000002';
  const partA = 'cccc0000-0000-4000-8000-000000000003';

  const diagnostic: CreateDiagnosticDto = {
    description: 'Frenos desgastados',
    suggestedTasks: ['Reemplazar pastillas'],
    suggestedPartIds: [partA],
    estimatedHours: 2,
  };

  function buildFixture() {
    const diagnosticRow = {
      id: 'dddd0000-0000-4000-8000-000000000004',
      workOrderId,
      description: diagnostic.description,
      suggestedTasks: diagnostic.suggestedTasks as unknown as Prisma.InputJsonValue,
      suggestedPartIds: diagnostic.suggestedPartIds as unknown as Prisma.InputJsonValue,
      estimatedHours: new Prisma.Decimal('2'),
      createdAt: new Date('2026-08-20T10:00:00Z'),
    };
    const tx = {
      diagnostic: { upsert: jest.fn().mockResolvedValue(diagnosticRow) },
      workOrder: {
        update: jest.fn().mockResolvedValue({ vehicleId }),
      },
      technicalHistory: { create: jest.fn().mockResolvedValue(undefined) },
    };
    const prisma = {
      $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)),
    };
    return { repository: new WorkOrderRepository(prisma as never), tx };
  }

  it('persists the diagnostic, updates the work order status and appends immutable history (RN-19)', async () => {
    const { repository, tx } = buildFixture();

    await repository.createDiagnostic(workOrderId, diagnostic, 'EN_DIAGNOSTICO');

    expect(tx.diagnostic.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workOrderId },
        create: expect.objectContaining({
          workOrderId,
          description: diagnostic.description,
          suggestedTasks: diagnostic.suggestedTasks,
          suggestedPartIds: diagnostic.suggestedPartIds,
        }),
      }),
    );
    expect(tx.workOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: workOrderId },
        data: { status: 'EN_DIAGNOSTICO' },
      }),
    );
    expect(tx.technicalHistory.create).toHaveBeenCalledWith({
      data: {
        vehicleId,
        description: expect.stringContaining(diagnostic.description),
      },
    });
  });

  it('suspends the order to PRESUPUESTO_ENVIADO inside the same transaction when there are additional findings (RN-03)', async () => {
    const { repository, tx } = buildFixture();

    await repository.createDiagnostic(workOrderId, diagnostic, 'PRESUPUESTO_ENVIADO');

    expect(tx.workOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: workOrderId },
        data: { status: 'PRESUPUESTO_ENVIADO' },
      }),
    );
    expect(tx.technicalHistory.create).toHaveBeenCalledTimes(1);
  });

  it('returns an explicit non-financial allowlist so no prices leak to the mechanic (RN-16)', async () => {
    const { repository } = buildFixture();

    const result = await repository.createDiagnostic(workOrderId, diagnostic, 'EN_DIAGNOSTICO');

    const keys = Object.keys(result);
    expect(keys).toEqual([
      'id',
      'workOrderId',
      'description',
      'suggestedTasks',
      'suggestedPartIds',
      'estimatedHours',
      'createdAt',
    ]);
    expect(result).not.toHaveProperty('unitPrice');
    expect(result).not.toHaveProperty('total');
    expect(result.estimatedHours).toBe(2);
  });
});

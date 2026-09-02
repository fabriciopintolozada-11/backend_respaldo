import { UnprocessableEntityException } from '@nestjs/common';
import { RegisterVehicleEntryDto } from '../src/modules/work-orders/dto/register-vehicle-entry.dto';
import { WorkOrderRepository } from '../src/modules/work-orders/repositories/work-order.repository';
import { WorkOrdersService } from '../src/modules/work-orders/work-orders.service';
import { CreateDiagnosticDto } from '../src/modules/work-orders/dto/create-diagnostic.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

describe('WorkOrdersService (HU-01)', () => {
  const repository = {
    createVehicleEntry: jest.fn(),
    findVehicleHistory: jest.fn(),
    findAssignedWorkOrder: jest.fn(),
    createDiagnostic: jest.fn(),
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

  describe('HU-01 Escenario 1: Registro exitoso de nuevo vehículo', () => {
    it("creates a work order in 'RECIBIDO' state with normalized plate", async () => {
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

  describe('HU-01 Escenario 2: Reutilización de vehículo existente', () => {
    it('passes normalized plate to repository for upsert logic', async () => {
      repository.createVehicleEntry = jest.fn().mockResolvedValue({
        id: 'work-order-new',
        vehicleId: 'existing-vehicle-id',
        customerId: 'original-customer-id',
        status: 'RECIBIDO',
        initialComplaint: dto.initialComplaint,
        createdAt: new Date(),
      });

      const result = await service.registerVehicleEntry(
        { ...dto, plate: '  abc-123  ' },
        'receptionist-id',
      );

      expect(result.status).toBe('RECIBIDO');
      expect(repository.createVehicleEntry).toHaveBeenCalledWith(
        { ...dto, plate: 'ABC-123' },
        'receptionist-id',
      );
    });
  });

  describe('HU-01 Escenario 3: Bloqueo de recepción para vehículos eléctricos (RN-18)', () => {
    it('rejects fully electric vehicles with HTTP 422', () => {
      const electricDto = { ...dto, vehicle: { ...dto.vehicle, isFullyElectric: true } };

      expect(() => service.registerVehicleEntry(electricDto, 'receptionist-id')).toThrow(UnprocessableEntityException);
      expect(repository.createVehicleEntry).not.toHaveBeenCalled();
    });
  });
});

describe('WorkOrdersService (HU-01) - Diagnostic tests', () => {
  const repository = {
    createVehicleEntry: jest.fn(),
    findVehicleHistory: jest.fn(),
    findAssignedWorkOrder: jest.fn(),
    createDiagnostic: jest.fn(),
  } as unknown as WorkOrderRepository;
  let service: WorkOrdersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WorkOrdersService(repository);
  });

  it('records a diagnosis for the assigned mechanic and moves the order to diagnosis', async () => {
    repository.findAssignedWorkOrder = jest.fn().mockResolvedValue({ status: 'ASIGNADA' });
    const diagnostic: CreateDiagnosticDto = { description: 'Brake wear', suggestedTasks: ['Replace pads'], suggestedPartIds: [], estimatedHours: 2 };
    repository.createDiagnostic = jest.fn().mockResolvedValue({ description: diagnostic.description });

    await service.createDiagnostic('work-order-id', 'mechanic-id', diagnostic);

    expect(repository.createDiagnostic).toHaveBeenCalledWith('work-order-id', diagnostic, 'EN_DIAGNOSTICO');
  });

  it('suspends a repair when a diagnosis adds findings (RN-03)', async () => {
    repository.findAssignedWorkOrder = jest.fn().mockResolvedValue({ status: 'EN_REPARACION' });
    const diagnostic: CreateDiagnosticDto = { description: 'Additional failure', suggestedTasks: [], suggestedPartIds: [], estimatedHours: 1 };
    repository.createDiagnostic = jest.fn().mockResolvedValue({});

    await service.createDiagnostic('work-order-id', 'mechanic-id', diagnostic);

    expect(repository.createDiagnostic).toHaveBeenCalledWith('work-order-id', diagnostic, 'PRESUPUESTO_ENVIADO');
  });

  it('rejects diagnosis when the mechanic is not assigned to the work order (RN-04)', async () => {
    repository.findAssignedWorkOrder = jest.fn().mockResolvedValue(null);
    const diagnostic: CreateDiagnosticDto = {
      description: 'Brake wear',
      suggestedTasks: ['Replace pads'],
      suggestedPartIds: [],
      estimatedHours: 2,
    };

    await expect(service.createDiagnostic('work-order-id', 'wrong-mechanic-id', diagnostic))
      .rejects.toThrow('RN-04: work order is not assigned to this mechanic');
    expect(repository.createDiagnostic).not.toHaveBeenCalled();
  });

  it('returns only non-financial diagnostic fields (RN-16)', async () => {
    repository.findAssignedWorkOrder = jest.fn().mockResolvedValue({ status: 'ASIGNADA' });
    const diagnostic: CreateDiagnosticDto = {
      description: 'Brake wear',
      suggestedTasks: ['Replace pads'],
      suggestedPartIds: [],
      estimatedHours: 2,
    };
    const response = {
      id: 'diagnostic-id',
      workOrderId: 'work-order-id',
      description: diagnostic.description,
      suggestedTasks: diagnostic.suggestedTasks,
      suggestedPartIds: diagnostic.suggestedPartIds,
      estimatedHours: diagnostic.estimatedHours,
      createdAt: new Date(),
    };
    repository.createDiagnostic = jest.fn().mockResolvedValue(response);

    const result = await service.createDiagnostic('work-order-id', 'mechanic-id', diagnostic);

    expect(result).not.toHaveProperty('price');
    expect(result).not.toHaveProperty('unitPrice');
    expect(result).not.toHaveProperty('total');
    expect(Object.keys(result)).toEqual([
      'id', 'workOrderId', 'description', 'suggestedTasks',
      'suggestedPartIds', 'estimatedHours', 'createdAt',
    ]);
  });

  it('rejects empty descriptions and negative estimated hours in the DTO', async () => {
    const invalid = plainToInstance(CreateDiagnosticDto, {
      description: '   ',
      suggestedTasks: [],
      suggestedPartIds: [],
      estimatedHours: -1,
    });

    const errors = await validate(invalid);

    expect(errors.map((error) => error.property)).toEqual(expect.arrayContaining(['description', 'estimatedHours']));
  });
});

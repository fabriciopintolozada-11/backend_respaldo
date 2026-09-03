import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnprocessableEntityException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { WorkOrdersService } from '../src/modules/work-orders/work-orders.service';
import { WorkOrderRepository } from '../src/modules/work-orders/repositories/work-order.repository';
import { CreateDiagnosticDto } from '../src/modules/work-orders/dto/create-diagnostic.dto';
import { DiagnosticResponseDto } from '../src/modules/work-orders/dto/diagnostic-response.dto';

describe('WorkOrdersService (HU-11 - Registrar diagnóstico)', () => {
  let service: WorkOrdersService;
  const repository = {
    findAssignedWorkOrder: jest.fn(),
    createDiagnostic: jest.fn(),
  };

  const mechanicId = '11111111-1111-4111-8111-111111111111';
  const workOrderId = 'aaaa0000-0000-4000-8000-000000000001';
  const partA = 'bbbb0000-0000-4000-8000-000000000002';
  const partB = 'cccc0000-0000-4000-8000-000000000003';

  const diagnostic: CreateDiagnosticDto = {
    description: 'Frenos desgastados y fuga de aceite',
    suggestedTasks: ['Reemplazar pastillas', 'Cambiar retenedores'],
    suggestedPartIds: [partA, partB],
    estimatedHours: 3.5,
  };

  const storedDiagnostic = {
    id: 'dddd0000-0000-4000-8000-000000000004',
    workOrderId,
    description: diagnostic.description,
    suggestedTasks: diagnostic.suggestedTasks,
    suggestedPartIds: diagnostic.suggestedPartIds,
    estimatedHours: diagnostic.estimatedHours,
    createdAt: new Date('2026-08-20T10:00:00Z'),
  } as unknown as DiagnosticResponseDto;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkOrdersService,
        { provide: WorkOrderRepository, useValue: repository },
      ],
    }).compile();
    service = module.get(WorkOrdersService);
  });

  // Escenario 1: Diagnóstico inicial - OT en 'recibido' o 'en_diagnostico'.
  describe('initial diagnosis (HU-11 - Escenario 1)', () => {
    it.each(['RECIBIDO', 'ASIGNADA', 'EN_DIAGNOSTICO'])(
      'moves a work order in state %s to EN_DIAGNOSTICO and persists the diagnostic',
      async (status) => {
        repository.findAssignedWorkOrder.mockResolvedValue({ status });
        repository.createDiagnostic.mockResolvedValue(storedDiagnostic);

        const result = await service.createDiagnostic(workOrderId, mechanicId, diagnostic);

        expect(repository.createDiagnostic).toHaveBeenCalledWith(
          workOrderId,
          diagnostic,
          'EN_DIAGNOSTICO',
        );
        expect(result.workOrderId).toBe(workOrderId);
        expect(result.description).toBe(diagnostic.description);
        expect(result.suggestedTasks).toEqual(diagnostic.suggestedTasks);
      },
    );

    it('registers the failures, hours and suggested parts from the DTO (RN-19 history is appended by the repository)', async () => {
      repository.findAssignedWorkOrder.mockResolvedValue({ status: 'ASIGNADA' });
      repository.createDiagnostic.mockResolvedValue(storedDiagnostic);

      await service.createDiagnostic(workOrderId, mechanicId, diagnostic);

      expect(repository.createDiagnostic).toHaveBeenCalledWith(
        workOrderId,
        expect.objectContaining({
          description: diagnostic.description,
          suggestedTasks: diagnostic.suggestedTasks,
          suggestedPartIds: diagnostic.suggestedPartIds,
          estimatedHours: diagnostic.estimatedHours,
        }),
        'EN_DIAGNOSTICO',
      );
    });
  });

  // Escenario 2: Falla adicional durante la reparación - RN-03.
  describe('additional findings during repair (HU-11 - Escenario 2 / RN-03)', () => {
    it('suspends the work order and returns it to PRESUPUESTO_ENVIADO when a new failure is found in EN_REPARACION', async () => {
      repository.findAssignedWorkOrder.mockResolvedValue({ status: 'EN_REPARACION' });
      repository.createDiagnostic.mockResolvedValue(storedDiagnostic);

      await service.createDiagnostic(workOrderId, mechanicId, diagnostic);

      expect(repository.createDiagnostic).toHaveBeenCalledWith(
        workOrderId,
        diagnostic,
        'PRESUPUESTO_ENVIADO',
      );
    });

    it('sends the PRESPUESTO_ENVIADO transition so the repository suspends repair (RN-03)', async () => {
      repository.findAssignedWorkOrder.mockResolvedValue({ status: 'EN_REPARACION' });
      repository.createDiagnostic.mockResolvedValue(storedDiagnostic);

      await service.createDiagnostic(workOrderId, mechanicId, diagnostic);

      const [orderIdArg, , targetStatus] = repository.createDiagnostic.mock.calls[0];
      expect(orderIdArg).toBe(workOrderId);
      expect(targetStatus).toBe('PRESUPUESTO_ENVIADO');

      // A work order suspended for additional findings is not eligible for part consumption
      // until a new client approval (RN-02/RN-09); no diagnostic is persisted for a wrong mechanic.
      expect(repository.findAssignedWorkOrder).toHaveBeenCalledWith(workOrderId, mechanicId);
    });
  });

  // RN-04: Validar que la OT pertenezca exclusivamente al mecánico autenticado.
  describe('ownership enforcement (RN-04)', () => {
    it('rejects the diagnosis when the work order is not assigned to the authenticated mechanic', async () => {
      repository.findAssignedWorkOrder.mockResolvedValue(null);

      await expect(
        service.createDiagnostic(workOrderId, mechanicId, diagnostic),
      ).rejects.toThrow(UnprocessableEntityException);

      expect(repository.createDiagnostic).not.toHaveBeenCalled();
    });

    it('does not leak any data when the mechanic does not own the work order (RN-04)', async () => {
      repository.findAssignedWorkOrder.mockResolvedValue(null);

      await expect(
        service.createDiagnostic(workOrderId, mechanicId, diagnostic),
      ).rejects.toThrow('RN-04: work order is not assigned to this mechanic');
    });
  });

  describe('invalid state transitions', () => {
    it('throws a ConflictException when the work order cannot receive a diagnostic in its current state', async () => {
      repository.findAssignedWorkOrder.mockResolvedValue({ status: 'FINALIZADO' });

      await expect(
        service.createDiagnostic(workOrderId, mechanicId, diagnostic),
      ).rejects.toThrow(ConflictException);

      expect(repository.createDiagnostic).not.toHaveBeenCalled();
    });
  });

  // RN-16: la respuesta no debe exponer precios de venta al mecánico.
  describe('financial data confidentiality (RN-16)', () => {
    it('returns only the diagnostic allowlist without any price or cost fields', async () => {
      repository.findAssignedWorkOrder.mockResolvedValue({ status: 'ASIGNADA' });
      repository.createDiagnostic.mockResolvedValue(storedDiagnostic);

      const result = await service.createDiagnostic(workOrderId, mechanicId, diagnostic);

      expect(result).not.toHaveProperty('unitPrice');
      expect(result).not.toHaveProperty('price');
      expect(result).not.toHaveProperty('total');
      expect(result).not.toHaveProperty('subtotal');
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
    });
  });

  // DTO validation (BE-T11.1): class-validator rules on CreateDiagnosticDto.
  describe('CreateDiagnosticDto validation (BE-T11.1)', () => {
    it('accepts a valid diagnostic payload', async () => {
      const instance = plainToInstance(CreateDiagnosticDto, diagnostic);
      const errors = await validate(instance);
      expect(errors).toHaveLength(0);
    });

    it('rejects a blank description', async () => {
      const instance = plainToInstance(CreateDiagnosticDto, { ...diagnostic, description: '   ' });
      const errors = await validate(instance);
      expect(errors.map((e) => e.property)).toContain('description');
    });

    it('rejects negative estimated hours', async () => {
      const instance = plainToInstance(CreateDiagnosticDto, { ...diagnostic, estimatedHours: -1 });
      const errors = await validate(instance);
      expect(errors.map((e) => e.property)).toContain('estimatedHours');
    });

    it('rejects suggested part ids that are not valid UUIDs', async () => {
      const instance = plainToInstance(CreateDiagnosticDto, {
        ...diagnostic,
        suggestedPartIds: ['not-a-uuid'],
      });
      const errors = await validate(instance);
      expect(errors.map((e) => e.property)).toContain('suggestedPartIds');
    });

    it('rejects a description shorter than 3 characters', async () => {
      const instance = plainToInstance(CreateDiagnosticDto, { ...diagnostic, description: 'ab' });
      const errors = await validate(instance);
      expect(errors.map((e) => e.property)).toContain('description');
    });
  });
});

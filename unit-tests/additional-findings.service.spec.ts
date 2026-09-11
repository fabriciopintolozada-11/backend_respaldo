import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../src/generated/prisma/client';
import { WorkOrdersService } from '../src/modules/work-orders/work-orders.service';
import { WorkOrderRepository } from '../src/modules/work-orders/repositories/work-order.repository';
import { ApproveAdditionalFindingDto } from '../src/modules/work-orders/dto/approve-additional-finding.dto';
import { RejectAdditionalFindingDto } from '../src/modules/work-orders/dto/reject-additional-finding.dto';
import { ApprovalChannel } from '../src/modules/quotes/dto/approve-quote.dto';

describe('WorkOrdersService.approveAdditionalFinding (US-21 / BE-T21.2)', () => {
  const repository = {
    findAdditionalFindingContext: jest.fn(),
    approveAdditionalFinding: jest.fn(),
    rejectAdditionalFinding: jest.fn(),
  } as unknown as WorkOrderRepository;
  let service: WorkOrdersService;

  const workOrderId = 'aaaa0000-0000-4000-8000-000000000001';
  const userId = 'bbbb0000-0000-4000-8000-000000000002';
  const dto: ApproveAdditionalFindingDto = {
    channel: ApprovalChannel.WHATSAPP,
    customerName: 'Juan Pérez',
    notes: 'El cliente aprobó los repuestos adicionales',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    const configService = { get: jest.fn().mockReturnValue(undefined) };
    service = new WorkOrdersService(repository, configService as never);
  });

  it('approves the annex using the official configured hourly rate (BE-12.5)', async () => {
    const context = {
      id: workOrderId,
      status: 'PRESUPUESTO_ENVIADO',
      additionalFindings: [{ id: 'finding-1', description: 'Fuga de aceite' }],
    };
    repository.findAdditionalFindingContext = jest.fn().mockResolvedValue(context);
    const response = { id: 'finding-1', status: 'APPROVED' };
    repository.approveAdditionalFinding = jest.fn().mockResolvedValue(response);

    const rate = jest.fn().mockReturnValue('75');
    const configSpy = { get: rate };
    service = new WorkOrdersService(repository, configSpy as never);

    const result = await service.approveAdditionalFinding(workOrderId, dto, userId);

    expect(repository.approveAdditionalFinding).toHaveBeenCalledWith(
      workOrderId,
      dto,
      userId,
      expect.any(Prisma.Decimal),
    );
    const passedRate = (repository.approveAdditionalFinding as jest.Mock).mock.calls[0][3] as Prisma.Decimal;
    expect(passedRate.toString()).toBe('75');
    expect(result.status).toBe('APPROVED');
  });

  it('falls back to the official 65 BOB/h rate when no environment value is set', async () => {
    repository.findAdditionalFindingContext = jest.fn().mockResolvedValue({
      id: workOrderId,
      status: 'PRESUPUESTO_ENVIADO',
      additionalFindings: [{ id: 'finding-1', description: 'Fuga de aceite' }],
    });
    repository.approveAdditionalFinding = jest.fn().mockResolvedValue({ status: 'APPROVED' });

    await service.approveAdditionalFinding(workOrderId, dto, userId);

    const passedRate = (repository.approveAdditionalFinding as jest.Mock).mock.calls[0][3] as Prisma.Decimal;
    expect(passedRate.toString()).toBe('65');
  });

  it('returns 404 when the work order does not exist', async () => {
    repository.findAdditionalFindingContext = jest.fn().mockResolvedValue(null);

    await expect(service.approveAdditionalFinding(workOrderId, dto, userId)).rejects.toThrow(NotFoundException);
    expect(repository.approveAdditionalFinding).not.toHaveBeenCalled();
  });

  it('rejects the approval while the order is not awaiting a budget', async () => {
    repository.findAdditionalFindingContext = jest.fn().mockResolvedValue({
      id: workOrderId,
      status: 'EN_REPARACION',
      additionalFindings: [],
    });

    await expect(service.approveAdditionalFinding(workOrderId, dto, userId)).rejects.toThrow(ConflictException);
    expect(repository.approveAdditionalFinding).not.toHaveBeenCalled();
  });

  it('rejects the approval when no annex is pending a decision', async () => {
    repository.findAdditionalFindingContext = jest.fn().mockResolvedValue({
      id: workOrderId,
      status: 'PRESUPUESTO_ENVIADO',
      additionalFindings: [],
    });

    await expect(service.approveAdditionalFinding(workOrderId, dto, userId)).rejects.toThrow(ConflictException);
    expect(repository.approveAdditionalFinding).not.toHaveBeenCalled();
  });
});

describe('WorkOrdersService.rejectAdditionalFinding (US-21 / BE-T21.2)', () => {
  const repository = {
    findAdditionalFindingContext: jest.fn(),
    approveAdditionalFinding: jest.fn(),
    rejectAdditionalFinding: jest.fn(),
  } as unknown as WorkOrderRepository;
  let service: WorkOrdersService;

  const workOrderId = 'aaaa0000-0000-4000-8000-000000000001';
  const userId = 'bbbb0000-0000-4000-8000-000000000002';
  const dto: RejectAdditionalFindingDto = { reason: 'El cliente solo autorizó la reparación original' };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WorkOrdersService(repository, { get: jest.fn() } as never);
  });

  it('rejects the annex and forwards the id, dto and user to the repository', async () => {
    repository.findAdditionalFindingContext = jest.fn().mockResolvedValue({
      id: workOrderId,
      status: 'PRESUPUESTO_ENVIADO',
      additionalFindings: [{ id: 'finding-1', description: 'Fuga de aceite' }],
    });
    repository.rejectAdditionalFinding = jest.fn().mockResolvedValue({ id: 'finding-1', status: 'REJECTED' });

    const result = await service.rejectAdditionalFinding(workOrderId, dto, userId);

    expect(repository.rejectAdditionalFinding).toHaveBeenCalledWith(workOrderId, dto, userId);
    expect(result.status).toBe('REJECTED');
  });

  it('returns 404 when the work order does not exist', async () => {
    repository.findAdditionalFindingContext = jest.fn().mockResolvedValue(null);

    await expect(service.rejectAdditionalFinding(workOrderId, dto, userId)).rejects.toThrow(NotFoundException);
    expect(repository.rejectAdditionalFinding).not.toHaveBeenCalled();
  });

  it('rejects the outcome while the order is not awaiting a budget', async () => {
    repository.findAdditionalFindingContext = jest.fn().mockResolvedValue({
      id: workOrderId,
      status: 'EN_REPARACION',
      additionalFindings: [],
    });

    await expect(service.rejectAdditionalFinding(workOrderId, dto, userId)).rejects.toThrow(ConflictException);
    expect(repository.rejectAdditionalFinding).not.toHaveBeenCalled();
  });
});
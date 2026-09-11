import { ConflictException, ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { WorkOrdersService } from '../src/modules/work-orders/work-orders.service';
import { WorkOrderRepository } from '../src/modules/work-orders/repositories/work-order.repository';
import { CompleteWorkOrderDto } from '../src/modules/work-orders/dto/complete-work-order.dto';

describe('WorkOrdersService - complete (US-19)', () => {
  let service: WorkOrdersService;
  let repository: jest.Mocked<WorkOrderRepository>;

  const MECHANIC_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  const WORK_ORDER_ID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
  const RECEPTIONIST_ID = 'c3d4e5f6-a7b8-9012-cdef-123456789012';

  beforeEach(() => {
    repository = {
      findCompleteContext: jest.fn(),
      completeWorkOrder: jest.fn(),
    } as unknown as jest.Mocked<WorkOrderRepository>;

    service = new WorkOrdersService(repository, { get: jest.fn() } as never);
  });

  const dto: CompleteWorkOrderDto = {
    finalMileage: 125400,
    closingNotes: 'Radiator replaced and road-tested',
  };

  const baseContext = {
    id: WORK_ORDER_ID,
    status: 'EN_REPARACION',
    mechanicId: MECHANIC_ID,
    vehicleId: 'd4e5f6a7-b8c9-0123-def0-234567890123',
    receptionistId: RECEPTIONIST_ID,
  };

  const successfulResponse = {
    id: WORK_ORDER_ID,
    status: 'LISTO_ENTREGA',
    completedAt: new Date(),
    bayNumber: 2,
    finalMileage: 125400,
    closingNotes: 'Radiator replaced and road-tested',
  };

  // --- Work order not found ---

  it('throws NotFoundException when work order does not exist', async () => {
    repository.findCompleteContext.mockResolvedValue(null);
    await expect(
      service.complete(WORK_ORDER_ID, MECHANIC_ID, 'MECHANIC', dto),
    ).rejects.toThrow(NotFoundException);
  });

  // --- RN-04: ownership validation ---

  it('rejects mechanic who does not own the work order with 403 (RN-04)', async () => {
    repository.findCompleteContext.mockResolvedValue({
      ...baseContext,
      mechanicId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    });

    await expect(
      service.complete(WORK_ORDER_ID, MECHANIC_ID, 'MECHANIC', dto),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows workshop lead regardless of mechanic assignment (RN-04)', async () => {
    repository.findCompleteContext.mockResolvedValue({
      ...baseContext,
      mechanicId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    });
    repository.completeWorkOrder.mockResolvedValue(successfulResponse);

    const result = await service.complete(
      WORK_ORDER_ID,
      'workshop-lead-id',
      'WORKSHOP_LEAD',
      dto,
    );

    expect(result.status).toBe('LISTO_ENTREGA');
  });

  // --- RN-05: state machine validation ---

  it('rejects completion with 422 when the order is awaiting spare parts (RN-05)', async () => {
    repository.findCompleteContext.mockResolvedValue({
      ...baseContext,
      status: 'EN_ESPERA_DE_REPUESTO',
    });

    await expect(
      service.complete(WORK_ORDER_ID, MECHANIC_ID, 'MECHANIC', dto),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('rejects completion with 409 when the order is in RECIBIDO status', async () => {
    repository.findCompleteContext.mockResolvedValue({ ...baseContext, status: 'RECIBIDO' });
    await expect(
      service.complete(WORK_ORDER_ID, MECHANIC_ID, 'MECHANIC', dto),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects completion with 409 when the order is in ASIGNADA status', async () => {
    repository.findCompleteContext.mockResolvedValue({ ...baseContext, status: 'ASIGNADA' });
    await expect(
      service.complete(WORK_ORDER_ID, MECHANIC_ID, 'MECHANIC', dto),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects completion with 409 when the order is in APROBADO status', async () => {
    repository.findCompleteContext.mockResolvedValue({ ...baseContext, status: 'APROBADO' });
    await expect(
      service.complete(WORK_ORDER_ID, MECHANIC_ID, 'MECHANIC', dto),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects completion with 409 when the order is in PRESUPUESTO_ENVIADO status', async () => {
    repository.findCompleteContext.mockResolvedValue({ ...baseContext, status: 'PRESUPUESTO_ENVIADO' });
    await expect(
      service.complete(WORK_ORDER_ID, MECHANIC_ID, 'MECHANIC', dto),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects completion with 409 when the order is already in LISTO_ENTREGA status', async () => {
    repository.findCompleteContext.mockResolvedValue({ ...baseContext, status: 'LISTO_ENTREGA' });
    await expect(
      service.complete(WORK_ORDER_ID, MECHANIC_ID, 'MECHANIC', dto),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects completion with 409 when the order is already in ENTREGADO status', async () => {
    repository.findCompleteContext.mockResolvedValue({ ...baseContext, status: 'ENTREGADO' });
    await expect(
      service.complete(WORK_ORDER_ID, MECHANIC_ID, 'MECHANIC', dto),
    ).rejects.toThrow(ConflictException);
  });

  // --- Success cases ---

  it('delegates to repository on valid assigned mechanic + EN_REPARACION', async () => {
    repository.findCompleteContext.mockResolvedValue(baseContext);
    repository.completeWorkOrder.mockResolvedValue(successfulResponse);

    const result = await service.complete(WORK_ORDER_ID, MECHANIC_ID, 'MECHANIC', dto);

    expect(repository.completeWorkOrder).toHaveBeenCalledWith(WORK_ORDER_ID, dto, MECHANIC_ID);
    expect(result.status).toBe('LISTO_ENTREGA');
    expect(result.bayNumber).toBe(2);
  });

  it('delegates to repository on valid workshop lead + EN_REPARACION', async () => {
    repository.findCompleteContext.mockResolvedValue(baseContext);
    repository.completeWorkOrder.mockResolvedValue(successfulResponse);

    const result = await service.complete(WORK_ORDER_ID, 'wl-id', 'WORKSHOP_LEAD', dto);

    expect(repository.completeWorkOrder).toHaveBeenCalledWith(WORK_ORDER_ID, dto, 'wl-id');
    expect(result.status).toBe('LISTO_ENTREGA');
  });

  it('delegates an empty DTO (no finalMileage, no notes)', async () => {
    repository.findCompleteContext.mockResolvedValue(baseContext);
    repository.completeWorkOrder.mockResolvedValue({
      ...successfulResponse,
      finalMileage: null,
      closingNotes: null,
    });

    const result = await service.complete(WORK_ORDER_ID, MECHANIC_ID, 'MECHANIC', {});

    expect(repository.completeWorkOrder).toHaveBeenCalledWith(WORK_ORDER_ID, {}, MECHANIC_ID);
    expect(result.finalMileage).toBeNull();
    expect(result.closingNotes).toBeNull();
  });
});
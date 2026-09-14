import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
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
    status: 'IN_REPAIR',
    mechanicId: MECHANIC_ID,
    vehicleId: 'd4e5f6a7-b8c9-0123-def0-234567890123',
    receptionistId: RECEPTIONIST_ID,
  };

  const successfulResponse = {
    id: WORK_ORDER_ID,
    status: 'READY_FOR_DELIVERY',
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

  it('rejects mechanic who does not own the work order (RN-04, BE-E12)', async () => {
    repository.findCompleteContext.mockResolvedValue({
      ...baseContext,
      mechanicId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    });

    await expect(
      service.complete(WORK_ORDER_ID, MECHANIC_ID, 'MECHANIC', dto),
    ).rejects.toThrow(UnprocessableEntityException);
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

    expect(result.status).toBe('READY_FOR_DELIVERY');
  });

  // --- RN-05: state machine validation ---

  it('rejects completion with 422 when the order is awaiting spare parts (RN-05)', async () => {
    repository.findCompleteContext.mockResolvedValue({
      ...baseContext,
      status: 'WAITING_FOR_PART',
    });

    await expect(
      service.complete(WORK_ORDER_ID, MECHANIC_ID, 'MECHANIC', dto),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('rejects completion with 409 when the order is in RECEIVED status', async () => {
    repository.findCompleteContext.mockResolvedValue({ ...baseContext, status: 'RECEIVED' });
    await expect(
      service.complete(WORK_ORDER_ID, MECHANIC_ID, 'MECHANIC', dto),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects completion with 409 when the order is in ASSIGNED status', async () => {
    repository.findCompleteContext.mockResolvedValue({ ...baseContext, status: 'ASSIGNED' });
    await expect(
      service.complete(WORK_ORDER_ID, MECHANIC_ID, 'MECHANIC', dto),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects completion with 409 when the order is in APPROVED status', async () => {
    repository.findCompleteContext.mockResolvedValue({ ...baseContext, status: 'APPROVED' });
    await expect(
      service.complete(WORK_ORDER_ID, MECHANIC_ID, 'MECHANIC', dto),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects completion with 409 when the order is in QUOTE_SENT status', async () => {
    repository.findCompleteContext.mockResolvedValue({ ...baseContext, status: 'QUOTE_SENT' });
    await expect(
      service.complete(WORK_ORDER_ID, MECHANIC_ID, 'MECHANIC', dto),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects completion with 409 when the order is already in READY_FOR_DELIVERY status', async () => {
    repository.findCompleteContext.mockResolvedValue({ ...baseContext, status: 'READY_FOR_DELIVERY' });
    await expect(
      service.complete(WORK_ORDER_ID, MECHANIC_ID, 'MECHANIC', dto),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects completion with 409 when the order is already in DELIVERED status', async () => {
    repository.findCompleteContext.mockResolvedValue({ ...baseContext, status: 'DELIVERED' });
    await expect(
      service.complete(WORK_ORDER_ID, MECHANIC_ID, 'MECHANIC', dto),
    ).rejects.toThrow(ConflictException);
  });

  // --- Success cases ---

  it('delegates to repository on valid assigned mechanic + IN_REPAIR', async () => {
    repository.findCompleteContext.mockResolvedValue(baseContext);
    repository.completeWorkOrder.mockResolvedValue(successfulResponse);

    const result = await service.complete(WORK_ORDER_ID, MECHANIC_ID, 'MECHANIC', dto);

    expect(repository.completeWorkOrder).toHaveBeenCalledWith(WORK_ORDER_ID, dto, MECHANIC_ID);
    expect(result.status).toBe('READY_FOR_DELIVERY');
    expect(result.bayNumber).toBe(2);
  });

  it('delegates to repository on valid workshop lead + IN_REPAIR', async () => {
    repository.findCompleteContext.mockResolvedValue(baseContext);
    repository.completeWorkOrder.mockResolvedValue(successfulResponse);

    const result = await service.complete(WORK_ORDER_ID, 'wl-id', 'WORKSHOP_LEAD', dto);

    expect(repository.completeWorkOrder).toHaveBeenCalledWith(WORK_ORDER_ID, dto, 'wl-id');
    expect(result.status).toBe('READY_FOR_DELIVERY');
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
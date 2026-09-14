import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { WorkOrdersService } from '../src/modules/work-orders/work-orders.service';
import { WorkOrderRepository } from '../src/modules/work-orders/repositories/work-order.repository';
import { SetAwaitingPartDto } from '../src/modules/work-orders/dto/set-awaiting-part.dto';

describe('WorkOrdersService - setAwaitingPart (US-13)', () => {
  let service: WorkOrdersService;
  let repository: jest.Mocked<WorkOrderRepository>;

  const MECHANIC_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  const WORK_ORDER_ID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
  const VEHICLE_ID = 'c3d4e5f6-a7b8-9012-cdef-123456789012';
  const SPARE_PART_ID = 'd4e5f6a7-b8c9-0123-def0-234567890123';
  const QUOTE_PART_ID = 'e5f6a7b8-c9d0-1234-ef01-345678901234';

  beforeEach(() => {
    repository = {
      findAwaitingPartContext: jest.fn(),
      setAwaitingPart: jest.fn(),
    } as unknown as jest.Mocked<WorkOrderRepository>;

    service = new WorkOrdersService(repository, { get: jest.fn() } as never);
  });

  const dto: SetAwaitingPartDto = {
    missingPartId: SPARE_PART_ID,
    quantity: 2,
    reason: 'Part not physically available in warehouse',
  };

  const baseContext = {
    id: WORK_ORDER_ID,
    status: 'IN_REPAIR',
    mechanicId: MECHANIC_ID,
    vehicleId: VEHICLE_ID,
    quote: {
      parts: [
        { id: QUOTE_PART_ID, sparePartId: SPARE_PART_ID, quantity: 3, status: 'RESERVED' },
      ],
    },
  };

  const successfulResponse = {
    id: WORK_ORDER_ID,
    status: 'WAITING_FOR_PART',
    missingPartId: SPARE_PART_ID,
    quantity: 2,
    reason: 'Part not physically available in warehouse',
    createdAt: new Date(),
  };

  // --- Work order not found ---

  it('throws NotFoundException when work order does not exist', async () => {
    repository.findAwaitingPartContext.mockResolvedValue(null);

    await expect(
      service.setAwaitingPart(WORK_ORDER_ID, MECHANIC_ID, 'MECHANIC', dto),
    ).rejects.toThrow(NotFoundException);
  });

  // --- RN-04: ownership validation ---

  it('rejects mechanic who does not own the work order (RN-04)', async () => {
    repository.findAwaitingPartContext.mockResolvedValue({
      ...baseContext,
      mechanicId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    });

    await expect(
      service.setAwaitingPart(WORK_ORDER_ID, MECHANIC_ID, 'MECHANIC', dto),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('allows workshop lead regardless of mechanic assignment (RN-04)', async () => {
    repository.findAwaitingPartContext.mockResolvedValue({
      ...baseContext,
      mechanicId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    });
    repository.setAwaitingPart.mockResolvedValue(successfulResponse);

    const result = await service.setAwaitingPart(
      WORK_ORDER_ID,
      'workshop-lead-id',
      'WORKSHOP_LEAD',
      dto,
    );

    expect(result.status).toBe('WAITING_FOR_PART');
  });

  // --- RN-05: state machine validation ---

  it('rejects when work order is in RECEIVED status (RN-05)', async () => {
    repository.findAwaitingPartContext.mockResolvedValue({
      ...baseContext,
      status: 'RECEIVED',
    });

    await expect(
      service.setAwaitingPart(WORK_ORDER_ID, MECHANIC_ID, 'MECHANIC', dto),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects when work order is in ASSIGNED status (RN-05)', async () => {
    repository.findAwaitingPartContext.mockResolvedValue({
      ...baseContext,
      status: 'ASSIGNED',
    });

    await expect(
      service.setAwaitingPart(WORK_ORDER_ID, MECHANIC_ID, 'MECHANIC', dto),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects when work order is in IN_DIAGNOSIS status (RN-05)', async () => {
    repository.findAwaitingPartContext.mockResolvedValue({
      ...baseContext,
      status: 'IN_DIAGNOSIS',
    });

    await expect(
      service.setAwaitingPart(WORK_ORDER_ID, MECHANIC_ID, 'MECHANIC', dto),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects when work order is in QUOTE_SENT status (RN-05)', async () => {
    repository.findAwaitingPartContext.mockResolvedValue({
      ...baseContext,
      status: 'QUOTE_SENT',
    });

    await expect(
      service.setAwaitingPart(WORK_ORDER_ID, MECHANIC_ID, 'MECHANIC', dto),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects when work order is in APPROVED status (RN-05)', async () => {
    repository.findAwaitingPartContext.mockResolvedValue({
      ...baseContext,
      status: 'APPROVED',
    });

    await expect(
      service.setAwaitingPart(WORK_ORDER_ID, MECHANIC_ID, 'MECHANIC', dto),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects when work order is in WAITING_FOR_PART status (RN-05)', async () => {
    repository.findAwaitingPartContext.mockResolvedValue({
      ...baseContext,
      status: 'WAITING_FOR_PART',
    });

    await expect(
      service.setAwaitingPart(WORK_ORDER_ID, MECHANIC_ID, 'MECHANIC', dto),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects when work order is in FINALIZED status (RN-05)', async () => {
    repository.findAwaitingPartContext.mockResolvedValue({
      ...baseContext,
      status: 'FINALIZED',
    });

    await expect(
      service.setAwaitingPart(WORK_ORDER_ID, MECHANIC_ID, 'MECHANIC', dto),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects when work order is in READY_FOR_DELIVERY status (RN-05)', async () => {
    repository.findAwaitingPartContext.mockResolvedValue({
      ...baseContext,
      status: 'READY_FOR_DELIVERY',
    });

    await expect(
      service.setAwaitingPart(WORK_ORDER_ID, MECHANIC_ID, 'MECHANIC', dto),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects when work order is in DELIVERED status (RN-05)', async () => {
    repository.findAwaitingPartContext.mockResolvedValue({
      ...baseContext,
      status: 'DELIVERED',
    });

    await expect(
      service.setAwaitingPart(WORK_ORDER_ID, MECHANIC_ID, 'MECHANIC', dto),
    ).rejects.toThrow(ConflictException);
  });

  // --- Spare part validation ---

  it('rejects when the spare part is not associated with the work order', async () => {
    repository.findAwaitingPartContext.mockResolvedValue(baseContext);

    const invalidDto: SetAwaitingPartDto = {
      missingPartId: 'f6a7b8c9-d0e1-2345-f012-456789012345',
      quantity: 1,
      reason: 'Some part not in the quote',
    };

    await expect(
      service.setAwaitingPart(WORK_ORDER_ID, MECHANIC_ID, 'MECHANIC', invalidDto),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('rejects when the work order has no quote parts', async () => {
    repository.findAwaitingPartContext.mockResolvedValue({
      ...baseContext,
      quote: { parts: [] },
    });

    await expect(
      service.setAwaitingPart(WORK_ORDER_ID, MECHANIC_ID, 'MECHANIC', dto),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('rejects when the work order has no quote', async () => {
    repository.findAwaitingPartContext.mockResolvedValue({
      ...baseContext,
      quote: null,
    });

    await expect(
      service.setAwaitingPart(WORK_ORDER_ID, MECHANIC_ID, 'MECHANIC', dto),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  // --- Success cases ---

  it('delegates to repository on valid mechanic + IN_REPAIR + valid part', async () => {
    repository.findAwaitingPartContext.mockResolvedValue(baseContext);
    repository.setAwaitingPart.mockResolvedValue(successfulResponse);

    const result = await service.setAwaitingPart(
      WORK_ORDER_ID,
      MECHANIC_ID,
      'MECHANIC',
      dto,
    );

    expect(repository.setAwaitingPart).toHaveBeenCalledWith(
      WORK_ORDER_ID,
      dto,
      MECHANIC_ID,
      VEHICLE_ID,
    );
    expect(result.status).toBe('WAITING_FOR_PART');
    expect(result.missingPartId).toBe(SPARE_PART_ID);
    expect(result.quantity).toBe(2);
  });

  it('delegates to repository on valid workshop lead + IN_REPAIR + valid part', async () => {
    repository.findAwaitingPartContext.mockResolvedValue(baseContext);
    repository.setAwaitingPart.mockResolvedValue(successfulResponse);

    const result = await service.setAwaitingPart(
      WORK_ORDER_ID,
      'wl-id',
      'WORKSHOP_LEAD',
      dto,
    );

    expect(result.status).toBe('WAITING_FOR_PART');
  });

  it('accepts a part even when its quote_part status is not RESERVED', async () => {
    // The mechanic may report a part that was proposed but never reserved
    // (e.g., the quote was approved but the part was out of stock at approval
    // time). The service only checks association, not reservation status.
    repository.findAwaitingPartContext.mockResolvedValue({
      ...baseContext,
      quote: {
        parts: [
          { id: QUOTE_PART_ID, sparePartId: SPARE_PART_ID, quantity: 1, status: 'PROPOSED' },
        ],
      },
    });
    repository.setAwaitingPart.mockResolvedValue(successfulResponse);

    const result = await service.setAwaitingPart(
      WORK_ORDER_ID,
      MECHANIC_ID,
      'MECHANIC',
      dto,
    );

    expect(result.status).toBe('WAITING_FOR_PART');
  });
});

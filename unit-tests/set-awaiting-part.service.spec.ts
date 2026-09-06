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

    service = new WorkOrdersService(repository);
  });

  const dto: SetAwaitingPartDto = {
    missingPartId: SPARE_PART_ID,
    quantity: 2,
    reason: 'Part not physically available in warehouse',
  };

  const baseContext = {
    id: WORK_ORDER_ID,
    status: 'EN_REPARACION',
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
    status: 'EN_ESPERA_DE_REPUESTO',
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

    expect(result.status).toBe('EN_ESPERA_DE_REPUESTO');
  });

  // --- RN-05: state machine validation ---

  it('rejects when work order is in RECIBIDO status (RN-05)', async () => {
    repository.findAwaitingPartContext.mockResolvedValue({
      ...baseContext,
      status: 'RECIBIDO',
    });

    await expect(
      service.setAwaitingPart(WORK_ORDER_ID, MECHANIC_ID, 'MECHANIC', dto),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects when work order is in ASIGNADA status (RN-05)', async () => {
    repository.findAwaitingPartContext.mockResolvedValue({
      ...baseContext,
      status: 'ASIGNADA',
    });

    await expect(
      service.setAwaitingPart(WORK_ORDER_ID, MECHANIC_ID, 'MECHANIC', dto),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects when work order is in EN_DIAGNOSTICO status (RN-05)', async () => {
    repository.findAwaitingPartContext.mockResolvedValue({
      ...baseContext,
      status: 'EN_DIAGNOSTICO',
    });

    await expect(
      service.setAwaitingPart(WORK_ORDER_ID, MECHANIC_ID, 'MECHANIC', dto),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects when work order is in PRESUPUESTO_ENVIADO status (RN-05)', async () => {
    repository.findAwaitingPartContext.mockResolvedValue({
      ...baseContext,
      status: 'PRESUPUESTO_ENVIADO',
    });

    await expect(
      service.setAwaitingPart(WORK_ORDER_ID, MECHANIC_ID, 'MECHANIC', dto),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects when work order is in APROBADO status (RN-05)', async () => {
    repository.findAwaitingPartContext.mockResolvedValue({
      ...baseContext,
      status: 'APROBADO',
    });

    await expect(
      service.setAwaitingPart(WORK_ORDER_ID, MECHANIC_ID, 'MECHANIC', dto),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects when work order is in EN_ESPERA_DE_REPUESTO status (RN-05)', async () => {
    repository.findAwaitingPartContext.mockResolvedValue({
      ...baseContext,
      status: 'EN_ESPERA_DE_REPUESTO',
    });

    await expect(
      service.setAwaitingPart(WORK_ORDER_ID, MECHANIC_ID, 'MECHANIC', dto),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects when work order is in FINALIZADO status (RN-05)', async () => {
    repository.findAwaitingPartContext.mockResolvedValue({
      ...baseContext,
      status: 'FINALIZADO',
    });

    await expect(
      service.setAwaitingPart(WORK_ORDER_ID, MECHANIC_ID, 'MECHANIC', dto),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects when work order is in LISTO_ENTREGA status (RN-05)', async () => {
    repository.findAwaitingPartContext.mockResolvedValue({
      ...baseContext,
      status: 'LISTO_ENTREGA',
    });

    await expect(
      service.setAwaitingPart(WORK_ORDER_ID, MECHANIC_ID, 'MECHANIC', dto),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects when work order is in ENTREGADO status (RN-05)', async () => {
    repository.findAwaitingPartContext.mockResolvedValue({
      ...baseContext,
      status: 'ENTREGADO',
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

  it('delegates to repository on valid mechanic + EN_REPARACION + valid part', async () => {
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
    expect(result.status).toBe('EN_ESPERA_DE_REPUESTO');
    expect(result.missingPartId).toBe(SPARE_PART_ID);
    expect(result.quantity).toBe(2);
  });

  it('delegates to repository on valid workshop lead + EN_REPARACION + valid part', async () => {
    repository.findAwaitingPartContext.mockResolvedValue(baseContext);
    repository.setAwaitingPart.mockResolvedValue(successfulResponse);

    const result = await service.setAwaitingPart(
      WORK_ORDER_ID,
      'wl-id',
      'WORKSHOP_LEAD',
      dto,
    );

    expect(result.status).toBe('EN_ESPERA_DE_REPUESTO');
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

    expect(result.status).toBe('EN_ESPERA_DE_REPUESTO');
  });
});

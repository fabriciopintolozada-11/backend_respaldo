import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '../src/generated/prisma/client';
import { WorkOrderRepository } from '../src/modules/work-orders/repositories/work-order.repository';
import { ApproveAdditionalFindingDto } from '../src/modules/work-orders/dto/approve-additional-finding.dto';
import { RejectAdditionalFindingDto } from '../src/modules/work-orders/dto/reject-additional-finding.dto';
import { ApprovalChannel } from '../src/modules/quotes/dto/approve-quote.dto';

const UUID_V4_PART = '0000-0000-4000-8000-00000000000';
const workOrderId = `aaaa${UUID_V4_PART}1`;
const userId = `bbbb${UUID_V4_PART}2`;
const partA = `cccc${UUID_V4_PART}3`;
const partB = `dddd${UUID_V4_PART}4`;
const quoteId = `eeee${UUID_V4_PART}5`;
const findingId = `ffff${UUID_V4_PART}6`;
const quotePartA = `abab${UUID_V4_PART}7`;

function buildPendingFinding() {
  const createdAt = new Date('2026-09-05T10:00:00Z');
  return {
    id: findingId,
    workOrderId,
    description: 'Fuga de aceite en el motor',
    suggestedTasks: ['Cambiar retenedores'],
    suggestedPartIds: [partA, partB] as unknown as Prisma.InputJsonValue,
    estimatedHours: new Prisma.Decimal('2.5'),
    status: 'PENDING_QUOTE',
    reportedBy: 'mechanic-id',
    decidedBy: null,
    decidedAt: null,
    channel: null,
    customerName: null,
    notes: null,
    rejectionReason: null,
    createdAt,
  };
}

function buildQuote() {
  return {
    id: quoteId,
    laborSubtotal: new Prisma.Decimal('130.00'),
    partsSubtotal: new Prisma.Decimal('850.00'),
    total: new Prisma.Decimal('980.00'),
    parts: [
      {
        id: quotePartA,
        sparePartId: partA,
        quantity: 1,
        unitPrice: new Prisma.Decimal('120.00'),
        status: 'RESERVED',
      },
    ],
  };
}

const dto: ApproveAdditionalFindingDto = {
  channel: ApprovalChannel.WHATSAPP,
  customerName: 'Juan Pérez',
  notes: 'El cliente aprobó el presupuesto adicional',
};

describe('WorkOrderRepository.approveAdditionalFinding (US-21 / BE-T21.2)', () => {
  let tx: Record<string, { [key: string]: jest.Mock }>;
  let repo: WorkOrderRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    tx = {
      workOrder: { findUnique: jest.fn(), update: jest.fn() },
      sparePart: { findMany: jest.fn(), updateMany: jest.fn() },
      quotePart: { create: jest.fn(), update: jest.fn() },
      quoteDetail: { create: jest.fn() },
      quote: { update: jest.fn() },
      additionalFinding: { update: jest.fn() },
      technicalHistory: { create: jest.fn() },
      notification: { create: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)),
    };
    repo = new WorkOrderRepository(prisma as never);
  });

  it('reserves the suggested parts, extends the quote and marks the annex APPROVED', async () => {
    tx.workOrder.findUnique.mockResolvedValue({
      id: workOrderId,
      status: 'QUOTE_SENT',
      vehicleId: 'vehicle-1',
      mechanicId: 'mechanic-id',
      quote: buildQuote(),
      additionalFindings: [buildPendingFinding()],
    });
    tx.sparePart.findMany.mockResolvedValue([
      { id: partA, unitPrice: new Prisma.Decimal('120.00') },
      { id: partB, unitPrice: new Prisma.Decimal('45.00') },
    ]);
    tx.sparePart.updateMany.mockResolvedValue({ count: 1 });
    tx.quotePart.update.mockResolvedValue({});
    tx.quotePart.create.mockResolvedValue({});
    tx.quoteDetail.create.mockResolvedValue({});
    tx.quote.update.mockResolvedValue({});
    tx.additionalFinding.update.mockResolvedValue({ ...buildPendingFinding(), status: 'APPROVED', decidedBy: userId, decidedAt: new Date(), channel: dto.channel, customerName: dto.customerName, notes: dto.notes });
    tx.workOrder.update.mockResolvedValue({});
    tx.technicalHistory.create.mockResolvedValue({});
    tx.notification.create.mockResolvedValue({});

    const result = await repo.approveAdditionalFinding(workOrderId, dto, userId, new Prisma.Decimal('65'));

    // partA already exists as a reserved quote line -> quantity is extended.
    expect(tx.quotePart.update).toHaveBeenCalledWith({
      where: { id: quotePartA },
      data: { quantity: 2, subtotal: new Prisma.Decimal('240.00'), status: 'RESERVED' },
    });
    // partB is new -> an additional reserved line is created.
    expect(tx.quotePart.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          quoteId,
          sparePartId: partB,
          quantity: 1,
          unitPrice: new Prisma.Decimal('45.00'),
          status: 'RESERVED',
        }),
      }),
    );
    // Stock reservation is guarded per suggested part.
    expect(tx.sparePart.updateMany).toHaveBeenCalledTimes(2);
    expect(tx.sparePart.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: partB, isActive: true, availableStock: { gte: 1 } },
        data: { availableStock: { decrement: 1 }, reservedStock: { increment: 1 } },
      }),
    );
    // The quote totals grow with the annex parts and labor (2.5h x 65 BO/h).
    const quoteUpdate = (tx.quote.update as jest.Mock).mock.calls[0][0];
    expect(quoteUpdate.data.laborSubtotal.toString()).toBe('292.5');
    expect(quoteUpdate.data.partsSubtotal.toString()).toBe('1015');
    expect(quoteUpdate.data.total.toString()).toBe('1307.5');
    // The order resumes repair and the annex is approved with the channel.
    expect(tx.workOrder.update).toHaveBeenCalledWith({ where: { id: workOrderId }, data: { status: 'IN_REPAIR' } });
    expect(tx.additionalFinding.update).toHaveBeenCalledWith({
      where: { id: findingId },
      data: expect.objectContaining({ status: 'APPROVED', decidedBy: userId, channel: dto.channel }),
    });
    expect(tx.technicalHistory.create).toHaveBeenCalledTimes(1);
    expect(tx.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ recipientId: 'mechanic-id', type: 'ADDITIONAL_FINDING_APPROVED' }) }),
    );
    expect(result.status).toBe('APPROVED');
  });

  it('throws 422 when a suggested part has insufficient available stock (RN-07)', async () => {
    tx.workOrder.findUnique.mockResolvedValue({
      id: workOrderId,
      status: 'QUOTE_SENT',
      vehicleId: 'vehicle-1',
      quote: buildQuote(),
      additionalFindings: [buildPendingFinding()],
    });
    tx.sparePart.findMany.mockResolvedValue([
      { id: partA, unitPrice: new Prisma.Decimal('120.00') },
      { id: partB, unitPrice: new Prisma.Decimal('45.00') },
    ]);
    tx.sparePart.updateMany.mockResolvedValue({ count: 0 });

    await expect(repo.approveAdditionalFinding(workOrderId, dto, userId, new Prisma.Decimal('65'))).rejects.toThrow(
      UnprocessableEntityException,
    );
  });

  it('returns 404 when a suggested spare part is unknown or inactive', async () => {
    tx.workOrder.findUnique.mockResolvedValue({
      id: workOrderId,
      status: 'QUOTE_SENT',
      vehicleId: 'vehicle-1',
      quote: buildQuote(),
      additionalFindings: [buildPendingFinding()],
    });
    tx.sparePart.findMany.mockResolvedValue([{ id: partA, unitPrice: new Prisma.Decimal('120.00') }]);

    await expect(repo.approveAdditionalFinding(workOrderId, dto, userId, new Prisma.Decimal('65'))).rejects.toThrow(
      NotFoundException,
    );
  });

  it('guards against a concurrent or non-awaiting order (BE-16)', async () => {
    tx.workOrder.findUnique.mockResolvedValue({
      id: workOrderId,
      status: 'IN_REPAIR',
      vehicleId: 'vehicle-1',
      quote: buildQuote(),
      additionalFindings: [],
    });

    await expect(repo.approveAdditionalFinding(workOrderId, dto, userId, new Prisma.Decimal('65'))).rejects.toThrow(
      ConflictException,
    );
  });

  it('guards against a missing pending annex', async () => {
    tx.workOrder.findUnique.mockResolvedValue({
      id: workOrderId,
      status: 'QUOTE_SENT',
      vehicleId: 'vehicle-1',
      quote: buildQuote(),
      additionalFindings: [],
    });

    await expect(repo.approveAdditionalFinding(workOrderId, dto, userId, new Prisma.Decimal('65'))).rejects.toThrow(
      ConflictException,
    );
  });

  it('exposes no financial field in the allowlist response (RN-16)', async () => {
    tx.workOrder.findUnique.mockResolvedValue({
      id: workOrderId,
      status: 'QUOTE_SENT',
      vehicleId: 'vehicle-1',
      mechanicId: null,
      quote: buildQuote(),
      additionalFindings: [buildPendingFinding()],
    });
    tx.sparePart.findMany.mockResolvedValue([
      { id: partA, unitPrice: new Prisma.Decimal('120.00') },
      { id: partB, unitPrice: new Prisma.Decimal('45.00') },
    ]);
    tx.sparePart.updateMany.mockResolvedValue({ count: 1 });
    tx.quotePart.update.mockResolvedValue({});
    tx.quotePart.create.mockResolvedValue({});
    tx.quoteDetail.create.mockResolvedValue({});
    tx.quote.update.mockResolvedValue({});
    tx.additionalFinding.update.mockResolvedValue({ ...buildPendingFinding(), status: 'APPROVED', decidedBy: userId, decidedAt: new Date() });
    tx.workOrder.update.mockResolvedValue({});
    tx.technicalHistory.create.mockResolvedValue({});
    tx.notification.create.mockResolvedValue({});

    const result = await repo.approveAdditionalFinding(workOrderId, dto, userId, new Prisma.Decimal('65'));

    expect(result).not.toHaveProperty('unitPrice');
    expect(result).not.toHaveProperty('total');
    expect(result).not.toHaveProperty('subtotal');
    expect(result.estimatedHours).toBe(2.5);
  });
});

describe('WorkOrderRepository.rejectAdditionalFinding (US-21 / BE-T21.2, RN-19)', () => {
  let tx: Record<string, { [key: string]: jest.Mock }>;
  let repo: WorkOrderRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    tx = {
      workOrder: { findUnique: jest.fn(), update: jest.fn() },
      additionalFinding: { update: jest.fn() },
      technicalHistory: { create: jest.fn() },
      notification: { create: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)),
    };
    repo = new WorkOrderRepository(prisma as never);
  });

  it('archives the annex as REJECTED with the reason and resumes the repair (RN-19)', async () => {
    const rejectDto: RejectAdditionalFindingDto = {
      reason: 'El cliente prefiere no reparar el daño adicional',
    };
    tx.workOrder.findUnique.mockResolvedValue({
      id: workOrderId,
      status: 'QUOTE_SENT',
      vehicleId: 'vehicle-1',
      mechanicId: 'mechanic-id',
      additionalFindings: [buildPendingFinding()],
    });
    tx.additionalFinding.update.mockResolvedValue({ ...buildPendingFinding(), status: 'REJECTED', decidedBy: userId, decidedAt: new Date(), rejectionReason: rejectDto.reason });
    tx.workOrder.update.mockResolvedValue({});
    tx.technicalHistory.create.mockResolvedValue({});
    tx.notification.create.mockResolvedValue({});

    const result = await repo.rejectAdditionalFinding(workOrderId, rejectDto, userId);

    expect(tx.additionalFinding.update).toHaveBeenCalledWith({
      where: { id: findingId },
      data: { status: 'REJECTED', decidedBy: userId, decidedAt: expect.any(Date), rejectionReason: rejectDto.reason },
    });
    expect(tx.workOrder.update).toHaveBeenCalledWith({ where: { id: workOrderId }, data: { status: 'IN_REPAIR' } });
    expect(tx.technicalHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          description: expect.stringContaining('Daño no reparado por decisión del cliente'),
        }),
      }),
    );
    expect(tx.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ recipientId: 'mechanic-id', type: 'ADDITIONAL_FINDING_REJECTED' }) }),
    );
    expect(result.status).toBe('REJECTED');
    expect(result.rejectionReason).toBe(rejectDto.reason);
  });

  it('guards against a non-awaiting order', async () => {
    tx.workOrder.findUnique.mockResolvedValue({
      id: workOrderId,
      status: 'READY_FOR_DELIVERY',
      vehicleId: 'vehicle-1',
      additionalFindings: [],
    });

    await expect(repo.rejectAdditionalFinding(workOrderId, { reason: 'Razón' }, userId)).rejects.toThrow(ConflictException);
  });

  it('returns 404 when there is no pending annex', async () => {
    tx.workOrder.findUnique.mockResolvedValue({
      id: workOrderId,
      status: 'QUOTE_SENT',
      vehicleId: 'vehicle-1',
      additionalFindings: [],
    });

    await expect(repo.rejectAdditionalFinding(workOrderId, { reason: 'Razón' }, userId)).rejects.toThrow(ConflictException);
  });
});
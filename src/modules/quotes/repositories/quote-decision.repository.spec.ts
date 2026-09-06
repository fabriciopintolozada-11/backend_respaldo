import { ApprovalChannel } from '../dto/approve-quote.dto';
import { QuoteDecision } from '../dto/quote-decision-response.dto';
import { QuoteRepository } from './quote.repository';

describe('QuoteRepository quote decisions', () => {
  it('reserves available parts and records an approval atomically', async () => {
    const tx = {
      quote: { findUnique: jest.fn().mockResolvedValue({
        id: 'quote-1',
        workOrder: { id: 'order-1', vehicleId: 'vehicle-1', mechanicId: 'mechanic-1', status: 'PRESUPUESTO_ENVIADO' },
        parts: [{ id: 'quote-part-1', sparePartId: 'part-1', quantity: 2, status: 'PROPOSED' }],
        approvals: [],
      }) },
      sparePart: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      quotePart: { update: jest.fn() },
      workOrder: { update: jest.fn() },
      technicalHistory: { create: jest.fn() },
      notification: { create: jest.fn() },
      quoteApproval: { create: jest.fn().mockResolvedValue({ id: 'approval-1', quoteId: 'quote-1', createdAt: new Date() }) },
    };
    const prisma = { $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)) };

    const result = await new QuoteRepository(prisma as never).approve('order-1', {
      channel: ApprovalChannel.WHATSAPP,
      customerName: 'Cliente',
      notes: 'Autorizado por WhatsApp',
    }, 'user-1');

    expect(tx.sparePart.updateMany).toHaveBeenCalledWith({
      where: { id: 'part-1', isActive: true, availableStock: { gte: 2 } },
      data: { availableStock: { decrement: 2 }, reservedStock: { increment: 2 } },
    });
    expect(tx.quotePart.update).toHaveBeenCalledWith({ where: { id: 'quote-part-1' }, data: { status: 'RESERVED' } });
    expect(tx.workOrder.update).toHaveBeenCalledWith({ where: { id: 'order-1' }, data: { status: 'APROBADO' } });
    expect(tx.notification.create).toHaveBeenCalledWith({
      data: { recipientId: 'mechanic-1', workOrderId: 'order-1', type: 'WORK_ORDER_APPROVED', message: 'Work order order-1 is approved and ready to start' },
    });
    expect(result.decision).toBe(QuoteDecision.APPROVED);
  });

  it('rejects without changing inventory and releases quoted parts', async () => {
    const tx = {
      quote: { findUnique: jest.fn().mockResolvedValue({
        id: 'quote-1',
        workOrder: { id: 'order-1', vehicleId: 'vehicle-1', mechanicId: null, status: 'PRESUPUESTO_ENVIADO' },
        parts: [{ id: 'quote-part-1', status: 'PROPOSED' }],
        approvals: [],
      }) },
      sparePart: { updateMany: jest.fn() },
      quotePart: { updateMany: jest.fn() },
      workOrder: { update: jest.fn() },
      technicalHistory: { create: jest.fn() },
      quoteApproval: { create: jest.fn().mockResolvedValue({ id: 'approval-1', quoteId: 'quote-1', createdAt: new Date() }) },
    };
    const prisma = { $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)) };

    const result = await new QuoteRepository(prisma as never).reject('order-1', { reason: 'Cliente no autoriza' }, 'user-1');

    expect(tx.sparePart.updateMany).not.toHaveBeenCalled();
    expect(tx.quotePart.updateMany).toHaveBeenCalledWith({ where: { quoteId: 'quote-1' }, data: { status: 'RELEASED' } });
    expect(result.decision).toBe(QuoteDecision.REJECTED);
  });
});

import { Prisma } from '../src/generated/prisma/client';
import { QuoteItemType } from '../src/modules/quotes/dto/create-quote.dto';
import { QuoteRepository } from '../src/modules/quotes/repositories/quote.repository';

// BE-E06 (HU-21): a re-quote must never physically delete budget lines. The
// previous active lines are superseded (SUPERSEDED) and the new proposal is
// appended, always inside the same transaction, and only PROPOSED/RESERVED
// parts are affected by later decisions.
describe('BE-E06 append-only re-quote (HU-21)', () => {
  it('supersedes the previous active lines and appends the new proposal', async () => {
    const tx = {
      workOrder: { findUnique: jest.fn().mockResolvedValue({ id: 'order-1' }), update: jest.fn() },
      quote: {
        findUnique: jest.fn().mockResolvedValue({ id: 'quote-1' }),
        update: jest.fn().mockResolvedValue({
          id: 'quote-1',
          details: [
            {
              id: 'new-detail-1',
              description: 'Nuevo filtro',
              itemType: 'PART',
              quantity: new Prisma.Decimal('1'),
              unitPrice: new Prisma.Decimal('15.75'),
              subtotal: new Prisma.Decimal('15.75'),
            },
          ],
          total: new Prisma.Decimal('15.75'),
          currency: 'BOB',
          createdAt: new Date('2026-08-30T00:00:00.000Z'),
        }),
      },
      sparePart: { findMany: jest.fn().mockResolvedValue([{ id: 'part-1', unitPrice: new Prisma.Decimal('15.75') }]) },
    };
    const prisma = { $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)) };
    const repository = new QuoteRepository(prisma as never);

    await repository.create('order-1', {
      items: [{ description: 'Nuevo filtro', itemType: QuoteItemType.PART, quantity: 1, unitPrice: 20, sparePartId: 'part-1' }],
    }, new Prisma.Decimal('65'));

    const update = tx.quote.update.mock.calls[0][0];
    // No physical delete anywhere in the re-quote payload.
    expect(JSON.stringify(update)).not.toContain('delete');
    // Old active details/parts are superseded, new ones are appended.
    expect(update.data.details.updateMany).toEqual({
      where: { status: 'ACTIVE' },
      data: { status: 'SUPERSEDED' },
    });
    expect(update.data.parts.updateMany).toEqual({
      where: { status: { notIn: ['INSTALLED', 'SUPERSEDED'] } },
      data: { status: 'SUPERSEDED' },
    });
    expect(update.data.details.create).toEqual([
      { description: 'Nuevo filtro', itemType: 'PART', quantity: new Prisma.Decimal('1'), unitPrice: new Prisma.Decimal('15.75'), subtotal: new Prisma.Decimal('15.75') },
    ]);
    expect(update.data.parts.create).toEqual([
      { sparePartId: 'part-1', quantity: 1, unitPrice: new Prisma.Decimal('15.75'), subtotal: new Prisma.Decimal('15.75') },
    ]);
    expect(tx.workOrder.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: { status: 'QUOTE_SENT' },
    });
  });

  it('releases still-reserved parts before superseding (HU-07 integration)', async () => {
    const tx = {
      workOrder: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'order-1',
          vehicleId: 'vehicle-1',
          quote: { parts: [{ id: 'rp-1', sparePartId: 'part-1', quantity: 2 }] },
        }),
        update: jest.fn(),
      },
      stockMovement: { aggregate: jest.fn().mockResolvedValue({ _sum: { quantity: 0 } }) },
      sparePart: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      quotePart: { update: jest.fn() },
      technicalHistory: { create: jest.fn() },
      quote: {
        findUnique: jest.fn().mockResolvedValue({ id: 'quote-1' }),
        update: jest.fn().mockResolvedValue({
          id: 'quote-1',
          details: [],
          total: new Prisma.Decimal('0'),
          currency: 'BOB',
          createdAt: new Date(),
        }),
      },
    };
    const prisma = { $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)) };
    const repository = new QuoteRepository(prisma as never);

    await repository.create('order-1', {
      items: [{ description: 'Solo mano de obra', itemType: QuoteItemType.LABOR, quantity: 1, unitPrice: 65 }],
    }, new Prisma.Decimal('65'));

    // RN-07: the pending reservation returns to the available stock.
    expect(tx.sparePart.updateMany).toHaveBeenCalledWith({
      where: { id: 'part-1', reservedStock: { gte: 2 } },
      data: { reservedStock: { decrement: 2 }, availableStock: { increment: 2 } },
    });
    expect(tx.quotePart.update).toHaveBeenCalledWith({ where: { id: 'rp-1' }, data: { status: 'RELEASED' } });
    expect(tx.technicalHistory.create).toHaveBeenCalledTimes(1);
    // The re-quote then supersedes the released lines and moves the order back
    // to a fresh budget awaiting a decision.
    expect(tx.quote.update).toHaveBeenCalled();
    expect(tx.workOrder.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: { status: 'QUOTE_SENT' },
    });
  });

  it('approve reserves only PROPOSED lines for the current budget', async () => {
    const tx = {
      quote: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'quote-1',
          workOrder: { id: 'order-1', vehicleId: 'vehicle-1', mechanicId: 'mechanic-1', status: 'QUOTE_SENT' },
          parts: [],
          approvals: [],
        }),
      },
      sparePart: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      quotePart: { update: jest.fn() },
      workOrder: { update: jest.fn() },
      technicalHistory: { create: jest.fn() },
      notification: { create: jest.fn() },
      quoteApproval: { create: jest.fn().mockResolvedValue({ id: 'approval-1', quoteId: 'quote-1', createdAt: new Date() }) },
    };
    const prisma = { $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)) };
    const repository = new QuoteRepository(prisma as never);

    await repository.approve('order-1', { channel: 'CALL' as never, customerName: 'Cliente', notes: 'Ok' }, 'user-1');

    // The query itself restricts the candidate lines to PROPOSED, so SUPERSEDED
    // and consumed lines can never be re-reserved.
    expect(tx.quote.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { workOrderId: 'order-1' },
      select: expect.objectContaining({
        parts: expect.objectContaining({ where: { status: 'PROPOSED' } }),
      }),
    }));
    expect(tx.sparePart.updateMany).not.toHaveBeenCalled();
  });

  it('findApprovalDetail pairs only ACTIVE details with live parts', async () => {
    const prisma = { quote: { findFirst: jest.fn().mockResolvedValue(null) } };
    const repository = new QuoteRepository(prisma as never);

    await repository.findApprovalDetail('order-1');

    expect(prisma.quote.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({
        details: expect.objectContaining({ where: { status: 'ACTIVE' } }),
        parts: expect.objectContaining({ where: { status: { in: ['PROPOSED', 'RESERVED', 'RELEASED'] } } }),
      }),
    }));
  });
});
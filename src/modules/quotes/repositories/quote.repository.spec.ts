import { Prisma } from '../../../generated/prisma/client';
import { QuoteItemType } from '../dto/create-quote.dto';
import { QuoteRepository } from './quote.repository';

describe('QuoteRepository', () => {
  it('calculates line subtotals and total in one transaction', async () => {
    const workOrder = { id: 'work-order-id' };
    const quote = {
      id: 'quote-id',
      details: [
        {
          id: 'detail-1',
          description: 'Cambio de aceite',
          itemType: 'LABOR',
          quantity: new Prisma.Decimal('2'),
          unitPrice: new Prisma.Decimal('50'),
          subtotal: new Prisma.Decimal('100'),
        },
      ],
      total: new Prisma.Decimal('100'),
      currency: 'BOB',
      createdAt: new Date('2026-08-30T00:00:00.000Z'),
    };
    const tx = {
      workOrder: {
        findUnique: jest.fn().mockResolvedValue(workOrder),
        update: jest.fn().mockResolvedValue(undefined),
      },
      quote: {
        upsert: jest.fn().mockResolvedValue(quote),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)),
    };
    const repository = new QuoteRepository(prisma as never);

    const result = await repository.create('work-order-id', {
      items: [{ description: 'Cambio de aceite', itemType: QuoteItemType.LABOR, quantity: 2, unitPrice: 50 }],
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.quote.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ total: new Prisma.Decimal('100'), currency: 'BOB' }),
    }));
    expect(tx.workOrder.update).toHaveBeenCalledWith({
      where: { id: 'work-order-id' },
      data: { status: 'PRESUPUESTO_ENVIADO' },
    });
    expect(result.total).toBe('100');
    expect(result.currency).toBe('BOB');
  });

  it('calculates decimal subtotals and totals with Prisma.Decimal', async () => {
    const tx = {
      workOrder: { findUnique: jest.fn().mockResolvedValue({ id: 'order-1' }), update: jest.fn() },
      quote: { upsert: jest.fn().mockResolvedValue({ id: 'q', details: [], total: new Prisma.Decimal('20.12'), currency: 'BOB', createdAt: new Date() }) },
    };
    const prisma = { $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)) };
    await new QuoteRepository(prisma as never).create('order-1', { items: [
      { description: 'Parte', itemType: QuoteItemType.PART, quantity: 0.1, unitPrice: 0.2 },
      { description: 'Mano de obra', itemType: QuoteItemType.LABOR, quantity: 2, unitPrice: 10.05 },
    ] });
    const create = tx.quote.upsert.mock.calls[0][0].create;
    expect(create.total).toEqual(new Prisma.Decimal('20.12'));
    expect(create.details.create[0].subtotal).toEqual(new Prisma.Decimal('0.02'));
    expect(create.details.create[1].subtotal).toEqual(new Prisma.Decimal('20.10'));
  });

  it('rejects a missing work order before quote persistence', async () => {
    const tx = { workOrder: { findUnique: jest.fn().mockResolvedValue(null) }, quote: { upsert: jest.fn() } };
    const prisma = { $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)) };
    await expect(new QuoteRepository(prisma as never).create('missing', { items: [{ description: 'Parte', itemType: QuoteItemType.PART, quantity: 1, unitPrice: 1 }] })).rejects.toThrow('Work order not found');
    expect(tx.quote.upsert).not.toHaveBeenCalled();
  });

  it('does not update the work order when quote persistence fails', async () => {
    const tx = { workOrder: { findUnique: jest.fn().mockResolvedValue({ id: 'order-1' }), update: jest.fn() }, quote: { upsert: jest.fn().mockRejectedValue(new Error('database failure')) } };
    const prisma = { $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)) };
    await expect(new QuoteRepository(prisma as never).create('order-1', { items: [{ description: 'Parte', itemType: QuoteItemType.PART, quantity: 1, unitPrice: 1 }] })).rejects.toThrow('database failure');
    expect(tx.workOrder.update).not.toHaveBeenCalled();
  });
});

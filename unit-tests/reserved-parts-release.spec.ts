import { UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '../src/generated/prisma/client';
import { releaseReservedParts } from '../src/modules/work-orders/repositories/reserved-parts-release';
import { SettlementRepository } from '../src/modules/settlements/repositories/settlement.repository';
import { QuoteRepository } from '../src/modules/quotes/repositories/quote.repository';
import { PaymentMethod } from '../src/modules/settlements/dto/deliver-work-order.dto';
import { QuoteItemType } from '../src/modules/quotes/dto/create-quote.dto';

// HU-07 / BE-E03: reserved spare parts must never stay permanently blocked.
// These tests cover the release helper and its integration inside the
// transactions that move a work order out of the repair flow: ENTREGADA
// (deliver), RECHAZADA (quote reject) and the re-quote that supersedes the
// previous budget (BE-E06 append-only).
describe('releaseReservedParts (HU-07 / BE-E03)', () => {
  describe('helper', () => {
    const reservedOrder = (parts: unknown[]) => ({
      id: 'wo-1',
      vehicleId: 'veh-1',
      quote: { parts },
    });

    const makeTx = (overrides: Record<string, unknown> = {}) => {
      const tx = {
        workOrder: { findUnique: jest.fn().mockResolvedValue(reservedOrder([
          { id: 'qp-1', sparePartId: 'sp-1', quantity: 3 },
        ])) },
        stockMovement: { aggregate: jest.fn().mockResolvedValue({ _sum: { quantity: 1 } }) },
        sparePart: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
        quotePart: { update: jest.fn().mockResolvedValue(undefined) },
        technicalHistory: { create: jest.fn().mockResolvedValue(undefined) },
        ...overrides,
      };
      return tx;
    };

    const run = (tx: Record<string, unknown>) =>
      releaseReservedParts(tx as never, 'wo-1');

    it('frees the pending reservation (quantity minus consumed) and marks the line RELEASED', async () => {
      const tx = makeTx();
      const released = await run(tx);

      expect(tx.stockMovement.aggregate).toHaveBeenCalledWith({
        _sum: { quantity: true },
        where: { workOrderId: 'wo-1', sparePartId: 'sp-1', type: 'OUT' },
      });
      // released = quantity(3) - consumed(1) = 2
      expect(tx.sparePart.updateMany).toHaveBeenCalledWith({
        where: { id: 'sp-1', reservedStock: { gte: 2 } },
        data: {
          reservedStock: { decrement: 2 },
          availableStock: { increment: 2 },
        },
      });
      expect(tx.quotePart.update).toHaveBeenCalledWith({
        where: { id: 'qp-1' },
        data: { status: 'RELEASED' },
      });
      expect(tx.technicalHistory.create).toHaveBeenCalledWith({
        data: {
          vehicleId: 'veh-1',
          description: expect.stringContaining('Reserved spare parts released for work order wo-1'),
        },
      });
      expect(released).toBe(1);
    });

    it('is a no-op when there are no reserved parts left', async () => {
      const tx = makeTx({
        workOrder: { findUnique: jest.fn().mockResolvedValue({ id: 'wo-1', vehicleId: 'veh-1', quote: null }) },
      });
      const released = await run(tx);

      expect(released).toBe(0);
      expect(tx.sparePart.updateMany).not.toHaveBeenCalled();
      expect(tx.technicalHistory.create).not.toHaveBeenCalled();
    });

    it('is a no-op when fully consumed installed parts have no pending reservation', async () => {
      const tx = makeTx({
        workOrder: { findUnique: jest.fn().mockResolvedValue(reservedOrder([
          { id: 'qp-1', sparePartId: 'sp-1', quantity: 2 },
        ])) },
        stockMovement: { aggregate: jest.fn().mockResolvedValue({ _sum: { quantity: 2 } }) },
      });
      const released = await run(tx);

      expect(released).toBe(0);
      expect(tx.sparePart.updateMany).not.toHaveBeenCalled();
      expect(tx.technicalHistory.create).not.toHaveBeenCalled();
    });

    it('aborts the transaction when the reserved stock does not back the reservation', async () => {
      const tx = makeTx({ sparePart: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) } });

      await expect(run(tx)).rejects.toThrow(UnprocessableEntityException);
      expect(tx.quotePart.update).not.toHaveBeenCalled();
    });
  });

  describe('integration: deliver (ENTREGADA)', () => {
    it('releases still-reserved parts inside the delivery transaction', async () => {
      const tx = {
        workOrder: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'wo-1',
            vehicleId: 'veh-1',
            status: 'LISTO_ENTREGA',
            deliveredAt: null,
            quote: {
              laborSubtotal: new Prisma.Decimal('0'),
              currency: 'BOB',
              parts: [
                { id: 'qp-1', sparePartId: 'sp-1', quantity: 2, status: 'RESERVED', subtotal: new Prisma.Decimal('0') },
              ],
            },
            settlementAdjustments: [],
          }),
          update: jest.fn().mockResolvedValue(undefined),
        },
        stockMovement: { aggregate: jest.fn().mockResolvedValue({ _sum: { quantity: 0 } }) },
        sparePart: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
        quotePart: { update: jest.fn().mockResolvedValue(undefined) },
        technicalHistory: { create: jest.fn().mockResolvedValue(undefined) },
      };
      const prisma = { $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)) };
      const repository = new SettlementRepository(prisma as never);

      await repository.deliverWorkOrder('wo-1', 'user-1', { paymentMethod: PaymentMethod.CASH, receiptNumber: 'R-1' });

      expect(tx.sparePart.updateMany).toHaveBeenCalledWith({
        where: { id: 'sp-1', reservedStock: { gte: 2 } },
        data: { reservedStock: { decrement: 2 }, availableStock: { increment: 2 } },
      });
      expect(tx.quotePart.update).toHaveBeenCalledWith({
        where: { id: 'qp-1' },
        data: { status: 'RELEASED' },
      });
      const historyDescriptions = tx.technicalHistory.create.mock.calls.map((c: [unknown]) => (c[0] as { data: { description: string } }).data.description);
      expect(historyDescriptions.some((d) => d.includes('Reserved spare parts released for work order wo-1'))).toBe(true);
    });
  });

  describe('integration: quote reject (RECHAZADA)', () => {
    it('releases defensively any still-reserved part before marking all lines RELEASED', async () => {
      const tx = {
        quote: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'quote-1',
            workOrder: { id: 'order-1', vehicleId: 'vehicle-1', status: 'PRESUPUESTO_ENVIADO' },
            parts: [{ id: 'quote-part-1', status: 'PROPOSED' }],
            approvals: [],
          }),
        },
        workOrder: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'order-1',
            vehicleId: 'vehicle-1',
            quote: { parts: [{ id: 'quote-part-1', sparePartId: 'sp-1', quantity: 2, status: 'RESERVED' }] },
          }),
          update: jest.fn(),
        },
        stockMovement: { aggregate: jest.fn().mockResolvedValue({ _sum: { quantity: 0 } }) },
        sparePart: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
        quotePart: { update: jest.fn(), updateMany: jest.fn() },
        technicalHistory: { create: jest.fn() },
        quoteApproval: { create: jest.fn().mockResolvedValue({ id: 'approval-1', quoteId: 'quote-1', createdAt: new Date() }) },
      };
      const prisma = { $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)) };
      const repository = new QuoteRepository(prisma as never);

      await repository.reject('order-1', { reason: 'Cliente no autoriza' }, 'user-1');

      expect(tx.sparePart.updateMany).toHaveBeenCalledWith({
        where: { id: 'sp-1', reservedStock: { gte: 2 } },
        data: { reservedStock: { decrement: 2 }, availableStock: { increment: 2 } },
      });
      expect(tx.quotePart.update).toHaveBeenCalledWith({
        where: { id: 'quote-part-1' },
        data: { status: 'RELEASED' },
      });
      // BE-E06 / HU-21: only live lines are closed as RELEASED.
      expect(tx.quotePart.updateMany).toHaveBeenCalledWith({ where: { quoteId: 'quote-1', status: { in: ['PROPOSED', 'RESERVED'] } }, data: { status: 'RELEASED' } });
      expect(tx.workOrder.update).toHaveBeenCalledWith({ where: { id: 'order-1' }, data: { status: 'RECHAZADO' } });
    });
  });

  describe('integration: re-quote superseding the previous budget', () => {
    it('releases still-reserved parts before superseding the previous quote lines', async () => {
      const tx = {
        workOrder: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'order-1',
            vehicleId: 'vehicle-1',
            quote: { parts: [{ id: 'old-qp', sparePartId: 'sp-1', quantity: 2, status: 'RESERVED' }] },
          }),
          update: jest.fn().mockResolvedValue(undefined),
        },
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
        sparePart: {
          findMany: jest.fn().mockResolvedValue([]),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        stockMovement: { aggregate: jest.fn().mockResolvedValue({ _sum: { quantity: 0 } }) },
        quotePart: { update: jest.fn().mockResolvedValue(undefined) },
        technicalHistory: { create: jest.fn().mockResolvedValue(undefined) },
      };
      const prisma = { $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)) };
      const repository = new QuoteRepository(prisma as never);

      await repository.create('order-1', { items: [{ description: 'Labor', itemType: QuoteItemType.LABOR, quantity: 1, unitPrice: 65 }] }, new Prisma.Decimal('65'));

      expect(tx.sparePart.updateMany).toHaveBeenCalledWith({
        where: { id: 'sp-1', reservedStock: { gte: 2 } },
        data: { reservedStock: { decrement: 2 }, availableStock: { increment: 2 } },
      });
      expect(tx.quotePart.update).toHaveBeenCalledWith({
        where: { id: 'old-qp' },
        data: { status: 'RELEASED' },
      });
      // BE-E06: the old lines are superseded, never deleted, and the new
      // proposal is appended on the same quote.
      const quoteUpdate = tx.quote.update.mock.calls[0][0];
      expect(quoteUpdate.data.details.updateMany).toEqual({
        where: { status: 'ACTIVE' },
        data: { status: 'SUPERSEDED' },
      });
      expect(quoteUpdate.data.parts.updateMany).toEqual({
        where: { status: { notIn: ['INSTALLED', 'SUPERSEDED'] } },
        data: { status: 'SUPERSEDED' },
      });
    });
  });
});
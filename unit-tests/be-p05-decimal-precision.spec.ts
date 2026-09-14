import { Prisma } from '../src/generated/prisma/client';
import { QuoteItemType } from '../src/modules/quotes/dto/create-quote.dto';
import { QuoteRepository } from '../src/modules/quotes/repositories/quote.repository';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { WorkOrderRepository } from '../src/modules/work-orders/repositories/work-order.repository';
import { ApproveAdditionalFindingDto } from '../src/modules/work-orders/dto/approve-additional-finding.dto';
import { ApprovalChannel } from '../src/modules/quotes/dto/approve-quote.dto';

// BE-P05 (RN-21): no Decimal -> Number -> Decimal round trips in monetary or
// labor-hour calculations. Subtotals/totals must match to the cent and quoted
// part quantities must be persisted as the exact validated integer.
describe('BE-P05 exact decimal math (HU-12 / RN-21)', () => {
  describe('QuoteRepository.create', () => {
    it('persists the integer part quantity and computes subtotals with Decimal.mul()', async () => {
      const tx = {
        workOrder: { findUnique: jest.fn().mockResolvedValue({ id: 'order-1' }), update: jest.fn() },
        quote: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({
            id: 'q',
            details: [],
            total: new Prisma.Decimal('210.00'),
            currency: 'BOB',
            createdAt: new Date(),
          }),
        },
        sparePart: {
          findMany: jest.fn().mockResolvedValue([{ id: 'part-1', unitPrice: new Prisma.Decimal('15.75') }]),
        },
      };
      const prisma = {
        $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)),
      };
      const repository = new QuoteRepository(prisma as never);

      await repository.create('order-1', {
        items: [
          { description: 'Bujia', itemType: QuoteItemType.PART, quantity: 3, unitPrice: 20, sparePartId: 'part-1' },
          { description: 'Mano de obra', itemType: QuoteItemType.LABOR, quantity: 2.5, unitPrice: 65 },
        ],
      }, new Prisma.Decimal('65'));

      const data = tx.quote.create.mock.calls[0][0].data;
      expect(data.total).toEqual(new Prisma.Decimal('209.75'));
      expect(data.partsSubtotal).toEqual(new Prisma.Decimal('47.25'));
      expect(data.laborSubtotal).toEqual(new Prisma.Decimal('162.50'));
      // QuotePart.quantity is a SMALLINT: the exact validated integer is sent,
      // never a Number(decimal) round trip.
      expect(data.parts.create[0].quantity).toBe(3);
      expect(data.parts.create[0].subtotal).toEqual(new Prisma.Decimal('47.25'));
      expect(data.parts.create[0].unitPrice).toEqual(new Prisma.Decimal('15.75'));
      // QuoteDetail keeps the Decimal quantity for labor hours.
      expect(data.details.create[1].quantity).toEqual(new Prisma.Decimal('2.5'));
      expect(data.details.create[1].subtotal).toEqual(new Prisma.Decimal('162.50'));
    });

    it('dedupes repeated parts by merging integer quantities before pricing', async () => {
      const tx = {
        workOrder: { findUnique: jest.fn().mockResolvedValue({ id: 'order-1' }), update: jest.fn() },
        quote: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: 'q', details: [], total: new Prisma.Decimal('63.00'), currency: 'BOB', createdAt: new Date() }),
        },
        sparePart: { findMany: jest.fn().mockResolvedValue([{ id: 'part-1', unitPrice: new Prisma.Decimal('15.75') }]) },
      };
      const prisma = { $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)) };

      await new QuoteRepository(prisma as never).create('order-1', {
        items: [
          { description: 'Bujia 1', itemType: QuoteItemType.PART, quantity: 2, unitPrice: 20, sparePartId: 'part-1' },
          { description: 'Bujia 2', itemType: QuoteItemType.PART, quantity: 2, unitPrice: 20, sparePartId: 'part-1' },
        ],
      }, new Prisma.Decimal('65'));

      const data = tx.quote.create.mock.calls[0][0].data;
      expect(data.partsSubtotal).toEqual(new Prisma.Decimal('63.00'));
      expect(data.parts.create[0].quantity).toBe(4);
      expect(data.parts.create[0].subtotal).toEqual(new Prisma.Decimal('63.00'));
    });

    it('throws when a part has no catalog price and does not persist (error path)', async () => {
      const tx = {
        workOrder: { findUnique: jest.fn().mockResolvedValue({ id: 'order-1' }), update: jest.fn() },
        quote: { findUnique: jest.fn(), create: jest.fn() },
        sparePart: { findMany: jest.fn().mockResolvedValue([{ id: 'other-part', unitPrice: new Prisma.Decimal('5') }]) },
      };
      const prisma = { $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)) };

      await expect(
        new QuoteRepository(prisma as never).create('order-1', {
          items: [{ description: 'Inexistente', itemType: QuoteItemType.PART, quantity: 1, unitPrice: 10, sparePartId: 'part-x' }],
        }, new Prisma.Decimal('65')),
      ).rejects.toThrow(NotFoundException);
      expect(tx.quote.findUnique).not.toHaveBeenCalled();
      expect(tx.quote.create).not.toHaveBeenCalled();
    });
  });

  describe('WorkOrderRepository.approveAdditionalFinding labor hours', () => {
    const workOrderId = 'aaaa0000-4000-8000-0000-000000000001';
    const userId = 'bbbb0000-4000-8000-0000-000000000002';
    const partA = 'cccc0000-4000-8000-0000-000000000003';
    const quotePartA = 'abab0000-4000-8000-0000-000000000007';
    const findingId = 'ffff0000-4000-8000-0000-000000000006';
    const quoteId = 'eeee0000-4000-8000-0000-000000000005';

    const dto: ApproveAdditionalFindingDto = {
      channel: ApprovalChannel.WHATSAPP,
      customerName: 'Juan Perez',
      notes: 'Aprobado',
    };

    function buildTx() {
      const tx = {
        workOrder: { findUnique: jest.fn(), update: jest.fn() },
        sparePart: { findMany: jest.fn(), updateMany: jest.fn() },
        quotePart: { create: jest.fn(), update: jest.fn() },
        quoteDetail: { create: jest.fn() },
        quote: { update: jest.fn() },
        additionalFinding: { update: jest.fn() },
        technicalHistory: { create: jest.fn() },
        notification: { create: jest.fn() },
      };
      return tx;
    }

    it('prices the labor item with the Decimal hours times the official rate (to the cent)', async () => {
      const tx = buildTx();
      const prisma = { $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)) };
      const repo = new WorkOrderRepository(prisma as never);

      tx.workOrder.findUnique.mockResolvedValue({
        id: workOrderId,
        status: 'PRESUPUESTO_ENVIADO',
        vehicleId: 'vehicle-1',
        mechanicId: 'mechanic-id',
        quote: {
          id: quoteId,
          laborSubtotal: new Prisma.Decimal('0.00'),
          partsSubtotal: new Prisma.Decimal('0.00'),
          total: new Prisma.Decimal('0.00'),
          parts: [{ id: quotePartA, sparePartId: partA, quantity: 1, unitPrice: new Prisma.Decimal('15.75'), status: 'RESERVED' }],
        },
        additionalFindings: [{
          id: findingId,
          workOrderId,
          description: 'Freno trasero',
          suggestedTasks: ['Cambiar pastillas'],
          suggestedPartIds: [partA] as unknown as Prisma.InputJsonValue,
          estimatedHours: new Prisma.Decimal('2.5'),
          status: 'PENDING_QUOTE',
          reportedBy: 'mechanic-id',
          decidedBy: null,
          decidedAt: null,
          channel: null,
          customerName: null,
          notes: null,
          rejectionReason: null,
          createdAt: new Date(),
        }],
      });
      tx.sparePart.findMany.mockResolvedValue([{ id: partA, unitPrice: new Prisma.Decimal('15.75') }]);
      tx.sparePart.updateMany.mockResolvedValue({ count: 1 });
      tx.quotePart.update.mockResolvedValue({});
      tx.quotePart.create.mockResolvedValue({});
      tx.quoteDetail.create.mockResolvedValue({});
      tx.quote.update.mockResolvedValue({});
      tx.additionalFinding.update.mockResolvedValue({
        id: findingId,
        workOrderId,
        description: 'Freno trasero',
        suggestedTasks: ['Cambiar pastillas'],
        suggestedPartIds: [partA],
        estimatedHours: new Prisma.Decimal('2.5'),
        status: 'APPROVED',
        reportedBy: 'mechanic-id',
        decidedBy: userId,
        decidedAt: new Date(),
        channel: ApprovalChannel.WHATSAPP,
        customerName: 'Juan Perez',
        notes: 'Aprobado',
        rejectionReason: null,
        createdAt: new Date(),
      });
      tx.workOrder.update.mockResolvedValue({});
      tx.technicalHistory.create.mockResolvedValue({});
      tx.notification.create.mockResolvedValue({});

      await repo.approveAdditionalFinding(workOrderId, dto, userId, new Prisma.Decimal('65'));

      // The labor quote detail keeps the exact Decimal hours and Decimal math.
      const laborDetail = tx.quoteDetail.create.mock.calls.find((call) => call[0].data.itemType === 'LABOR');
      expect(laborDetail).toBeDefined();
      expect(laborDetail![0].data.quantity).toEqual(new Prisma.Decimal('2.5'));
      expect(laborDetail![0].data.subtotal).toEqual(new Prisma.Decimal('162.50'));

      const quoteUpdate = (tx.quote.update as jest.Mock).mock.calls[0][0];
      expect(quoteUpdate.data.laborSubtotal).toEqual(new Prisma.Decimal('162.50'));
      expect(quoteUpdate.data.partsSubtotal).toEqual(new Prisma.Decimal('15.75'));
      expect(quoteUpdate.data.total).toEqual(new Prisma.Decimal('178.25'));
    });

    it('keeps the installed part extension on the integer quantity with Decimal subtotal', async () => {
      const tx = buildTx();
      const prisma = { $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)) };
      const repo = new WorkOrderRepository(prisma as never);

      tx.workOrder.findUnique.mockResolvedValue({
        id: workOrderId,
        status: 'PRESUPUESTO_ENVIADO',
        vehicleId: 'vehicle-1',
        mechanicId: 'mechanic-id',
        quote: {
          id: quoteId,
          laborSubtotal: new Prisma.Decimal('32.50'),
          partsSubtotal: new Prisma.Decimal('15.75'),
          total: new Prisma.Decimal('48.25'),
          parts: [{ id: quotePartA, sparePartId: partA, quantity: 1, unitPrice: new Prisma.Decimal('15.75'), status: 'RESERVED' }],
        },
        additionalFindings: [{
          id: findingId,
          workOrderId,
          description: 'Freno trasero',
          suggestedTasks: ['Cambiar pastillas'],
          suggestedPartIds: [partA] as unknown as Prisma.InputJsonValue,
          estimatedHours: new Prisma.Decimal('0.5'),
          status: 'PENDING_QUOTE',
          reportedBy: 'mechanic-id',
          decidedBy: null,
          decidedAt: null,
          channel: null,
          customerName: null,
          notes: null,
          rejectionReason: null,
          createdAt: new Date(),
        }],
      });
      tx.sparePart.findMany.mockResolvedValue([{ id: partA, unitPrice: new Prisma.Decimal('15.75') }]);
      tx.sparePart.updateMany.mockResolvedValue({ count: 1 });
      tx.quotePart.update.mockResolvedValue({});
      tx.quotePart.create.mockResolvedValue({});
      tx.quoteDetail.create.mockResolvedValue({});
      tx.quote.update.mockResolvedValue({});
      tx.additionalFinding.update.mockResolvedValue({
        id: findingId,
        workOrderId,
        description: 'Freno trasero',
        suggestedTasks: ['Cambiar pastillas'],
        suggestedPartIds: [partA],
        estimatedHours: new Prisma.Decimal('0.5'),
        status: 'APPROVED',
        reportedBy: 'mechanic-id',
        decidedBy: userId,
        decidedAt: new Date(),
        channel: ApprovalChannel.WHATSAPP,
        customerName: 'Juan Perez',
        notes: 'Aprobado',
        rejectionReason: null,
        createdAt: new Date(),
      });
      tx.workOrder.update.mockResolvedValue({});
      tx.technicalHistory.create.mockResolvedValue({});
      tx.notification.create.mockResolvedValue({});

      await repo.approveAdditionalFinding(workOrderId, dto, userId, new Prisma.Decimal('65'));

      // The existing part line grows to qty 2; subtotal 15.75 * 2 = 31.50.
      expect(tx.quotePart.update).toHaveBeenCalledWith({
        where: { id: quotePartA },
        data: { quantity: 2, subtotal: new Prisma.Decimal('31.50'), status: 'RESERVED' },
      });
      const quoteUpdate = (tx.quote.update as jest.Mock).mock.calls[0][0];
      expect(quoteUpdate.data.partsSubtotal).toEqual(new Prisma.Decimal('31.50'));
      expect(quoteUpdate.data.laborSubtotal).toEqual(new Prisma.Decimal('65.00'));
      expect(quoteUpdate.data.total).toEqual(new Prisma.Decimal('96.50'));
    });

    it('rejects when a suggested part cannot be reserved (error path, RN-07)', async () => {
      const tx = buildTx();
      const prisma = { $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)) };
      const repo = new WorkOrderRepository(prisma as never);

      tx.workOrder.findUnique.mockResolvedValue({
        id: workOrderId,
        status: 'PRESUPUESTO_ENVIADO',
        vehicleId: 'vehicle-1',
        mechanicId: 'mechanic-id',
        quote: {
          id: quoteId,
          laborSubtotal: new Prisma.Decimal('0.00'),
          partsSubtotal: new Prisma.Decimal('0.00'),
          total: new Prisma.Decimal('0.00'),
          parts: [],
        },
        additionalFindings: [{
          id: findingId,
          workOrderId,
          description: 'Freno trasero',
          suggestedTasks: ['Cambiar pastillas'],
          suggestedPartIds: [partA] as unknown as Prisma.InputJsonValue,
          estimatedHours: new Prisma.Decimal('2'),
          status: 'PENDING_QUOTE',
          reportedBy: 'mechanic-id',
          decidedBy: null,
          decidedAt: null,
          channel: null,
          customerName: null,
          notes: null,
          rejectionReason: null,
          createdAt: new Date(),
        }],
      });
      tx.sparePart.findMany.mockResolvedValue([{ id: partA, unitPrice: new Prisma.Decimal('15.75') }]);
      tx.sparePart.updateMany.mockResolvedValue({ count: 0 });

      await expect(repo.approveAdditionalFinding(workOrderId, dto, userId, new Prisma.Decimal('65'))).rejects.toThrow(
        UnprocessableEntityException,
      );
    });
  });
});
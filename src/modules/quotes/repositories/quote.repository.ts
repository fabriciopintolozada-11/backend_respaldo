import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateQuoteDto, QuoteItemType } from '../dto/create-quote.dto';
import { ApproveQuoteDto } from '../dto/approve-quote.dto';
import { RejectQuoteDto } from '../dto/reject-quote.dto';
import { QuoteDecision, QuoteDecisionResponseDto } from '../dto/quote-decision-response.dto';
import { QuoteResponseDto } from '../dto/quote-response.dto';

@Injectable()
export class QuoteRepository {
  constructor(private readonly prisma: PrismaService) {}

  findOrderForQuote(workOrderId: string) {
    return this.prisma.workOrder.findFirst({ where: { id: workOrderId, diagnostic: { isNot: null } }, select: { status: true } });
  }

  create(workOrderId: string, dto: CreateQuoteDto): Promise<QuoteResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.workOrder.findUnique({ where: { id: workOrderId }, select: { id: true } });
      if (!order) throw new NotFoundException('Work order not found');

      const partIds = dto.items.filter((item) => item.itemType === QuoteItemType.PART).map((item) => item.sparePartId);
      if (partIds.some((id) => !id)) throw new NotFoundException('Part items require a sparePartId');
      const parts = partIds.length > 0
        ? await tx.sparePart.findMany({ where: { id: { in: partIds as string[] }, isActive: true } })
        : [];
      const details = dto.items.map((item) => {
        const quantity = new Prisma.Decimal(item.quantity);
        const catalogPart = item.sparePartId ? parts.find((part) => part.id === item.sparePartId) : undefined;
        if (item.itemType === QuoteItemType.PART && !catalogPart) throw new NotFoundException('Spare part not found');
        const unitPrice = catalogPart?.unitPrice ?? new Prisma.Decimal(item.unitPrice);
        return { ...item, quantity, unitPrice, subtotal: quantity.mul(unitPrice) };
      });
      const total = details.reduce((sum, item) => sum.plus(item.subtotal), new Prisma.Decimal(0));
      const laborSubtotal = details.filter((item) => item.itemType === QuoteItemType.LABOR).reduce((sum, item) => sum.plus(item.subtotal), new Prisma.Decimal(0));
      const partsSubtotal = details.filter((item) => item.itemType === QuoteItemType.PART).reduce((sum, item) => sum.plus(item.subtotal), new Prisma.Decimal(0));
       const partItems = details.filter((item) => item.itemType === QuoteItemType.PART && item.sparePartId);
       const quote = await tx.quote.upsert({
         where: { workOrderId },
          update: { total, laborSubtotal, partsSubtotal, currency: 'BOB', details: { deleteMany: {}, create: details.map((item) => ({ description: item.description, itemType: item.itemType, quantity: item.quantity, unitPrice: item.unitPrice, subtotal: item.subtotal })) }, parts: { deleteMany: {}, create: partItems.map((item) => ({ sparePartId: item.sparePartId as string, quantity: Number(item.quantity), unitPrice: item.unitPrice, subtotal: item.subtotal })) } },
          create: { workOrderId, total, laborSubtotal, partsSubtotal, currency: 'BOB', details: { create: details.map((item) => ({ description: item.description, itemType: item.itemType, quantity: item.quantity, unitPrice: item.unitPrice, subtotal: item.subtotal })) }, parts: { create: partItems.map((item) => ({ sparePartId: item.sparePartId as string, quantity: Number(item.quantity), unitPrice: item.unitPrice, subtotal: item.subtotal })) } },
        include: { details: true },
      });
      await tx.workOrder.update({ where: { id: workOrderId }, data: { status: 'PRESUPUESTO_ENVIADO' } });
       return { id: quote.id, workOrderId, items: quote.details.map((item: { id: string; description: string; itemType: string; quantity: Prisma.Decimal; unitPrice: Prisma.Decimal; subtotal: Prisma.Decimal }) => ({ id: item.id, description: item.description, itemType: item.itemType as QuoteItemType, quantity: item.quantity.toString(), unitPrice: item.unitPrice.toString(), subtotal: item.subtotal.toString() })), total: quote.total.toString(), laborSubtotal: laborSubtotal.toString(), partsSubtotal: partsSubtotal.toString(), currency: quote.currency, createdAt: quote.createdAt };
    });
  }

  findDecisionContext(workOrderId: string) {
    return this.prisma.quote.findUnique({
      where: { workOrderId },
      select: { id: true, workOrder: { select: { id: true, status: true } } },
    });
  }

  approve(workOrderId: string, dto: ApproveQuoteDto, recordedBy: string): Promise<QuoteDecisionResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const quote = await tx.quote.findUnique({
        where: { workOrderId },
        select: { id: true, workOrder: { select: { id: true, vehicleId: true, mechanicId: true, status: true } }, parts: { select: { id: true, sparePartId: true, quantity: true, status: true } }, approvals: { select: { id: true } } },
      });
      if (!quote) throw new NotFoundException('Quote not found');
      if (quote.workOrder.status !== 'PRESUPUESTO_ENVIADO') throw new ConflictException('Quote is not awaiting a decision');
      if (quote.approvals.length > 0) throw new ConflictException('Quote already has a decision');

      for (const part of quote.parts) {
        const updated = await tx.sparePart.updateMany({
          where: { id: part.sparePartId, isActive: true, availableStock: { gte: part.quantity } },
          data: { availableStock: { decrement: part.quantity }, reservedStock: { increment: part.quantity } },
        });
        if (updated.count !== 1) throw new UnprocessableEntityException('Insufficient available stock for a quoted spare part');
        await tx.quotePart.update({ where: { id: part.id }, data: { status: 'RESERVED' } });
      }

      await tx.workOrder.update({ where: { id: workOrderId }, data: { status: 'APROBADO' } });
      await tx.technicalHistory.create({ data: { vehicleId: quote.workOrder.vehicleId, description: `Quote approved for work order ${workOrderId}` } });
      if (quote.workOrder.mechanicId) {
        await tx.notification.create({
          data: { recipientId: quote.workOrder.mechanicId, workOrderId, type: 'WORK_ORDER_APPROVED', message: `Work order ${workOrderId} is approved and ready to start` },
        });
      }
      const approval = await tx.quoteApproval.create({
        data: { quoteId: quote.id, decision: QuoteDecision.APPROVED, channel: dto.channel, customerName: dto.customerName, notes: dto.notes, recordedBy },
      });
      return { id: approval.id, quoteId: approval.quoteId, workOrderId, decision: QuoteDecision.APPROVED, channel: dto.channel, customerName: dto.customerName, notes: dto.notes, createdAt: approval.createdAt };
    });
  }

  reject(workOrderId: string, dto: RejectQuoteDto, recordedBy: string): Promise<QuoteDecisionResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const quote = await tx.quote.findUnique({
        where: { workOrderId },
        select: { id: true, workOrder: { select: { id: true, vehicleId: true, status: true } }, parts: { select: { id: true, status: true } }, approvals: { select: { id: true } } },
      });
      if (!quote) throw new NotFoundException('Quote not found');
      if (quote.workOrder.status !== 'PRESUPUESTO_ENVIADO') throw new ConflictException('Quote is not awaiting a decision');
      if (quote.approvals.length > 0) throw new ConflictException('Quote already has a decision');

      await tx.quotePart.updateMany({ where: { quoteId: quote.id }, data: { status: 'RELEASED' } });
      await tx.workOrder.update({ where: { id: workOrderId }, data: { status: 'RECHAZADO' } });
      await tx.technicalHistory.create({ data: { vehicleId: quote.workOrder.vehicleId, description: `Quote rejected for work order ${workOrderId}: ${dto.reason}` } });
      const approval = await tx.quoteApproval.create({ data: { quoteId: quote.id, decision: QuoteDecision.REJECTED, reason: dto.reason, recordedBy } });
      return { id: approval.id, quoteId: approval.quoteId, workOrderId, decision: QuoteDecision.REJECTED, reason: dto.reason, createdAt: approval.createdAt };
    });
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateQuoteDto, QuoteItemType } from '../dto/create-quote.dto';
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
      const quote = await tx.quote.upsert({
        where: { workOrderId },
         update: { total, laborSubtotal, partsSubtotal, currency: 'BOB', details: { deleteMany: {}, create: details.map((item) => ({ description: item.description, itemType: item.itemType, quantity: item.quantity, unitPrice: item.unitPrice, subtotal: item.subtotal })) } },
         create: { workOrderId, total, laborSubtotal, partsSubtotal, currency: 'BOB', details: { create: details.map((item) => ({ description: item.description, itemType: item.itemType, quantity: item.quantity, unitPrice: item.unitPrice, subtotal: item.subtotal })) } },
        include: { details: true },
      });
      await tx.workOrder.update({ where: { id: workOrderId }, data: { status: 'PRESUPUESTO_ENVIADO' } });
       return { id: quote.id, workOrderId, items: quote.details.map((item: { id: string; description: string; itemType: string; quantity: Prisma.Decimal; unitPrice: Prisma.Decimal; subtotal: Prisma.Decimal }) => ({ id: item.id, description: item.description, itemType: item.itemType as QuoteItemType, quantity: item.quantity.toString(), unitPrice: item.unitPrice.toString(), subtotal: item.subtotal.toString() })), total: quote.total.toString(), laborSubtotal: laborSubtotal.toString(), partsSubtotal: partsSubtotal.toString(), currency: quote.currency, createdAt: quote.createdAt };
    });
  }
}

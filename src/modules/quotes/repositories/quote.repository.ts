import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateQuoteDto, QuoteItemType } from '../dto/create-quote.dto';
import { QuoteResponseDto } from '../dto/quote-response.dto';

@Injectable()
export class QuoteRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(workOrderId: string, dto: CreateQuoteDto): Promise<QuoteResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.workOrder.findUnique({ where: { id: workOrderId }, select: { id: true } });
      if (!order) throw new NotFoundException('Work order not found');

      const details = dto.items.map((item) => {
        const quantity = new Prisma.Decimal(item.quantity);
        const unitPrice = new Prisma.Decimal(item.unitPrice);
        return { ...item, quantity, unitPrice, subtotal: quantity.mul(unitPrice) };
      });
      const total = details.reduce((sum, item) => sum.plus(item.subtotal), new Prisma.Decimal(0));
      const quote = await tx.quote.upsert({
        where: { workOrderId },
        update: { total, currency: 'BOB', details: { deleteMany: {}, create: details.map((item) => ({ description: item.description, itemType: item.itemType, quantity: item.quantity, unitPrice: item.unitPrice, subtotal: item.subtotal })) } },
        create: { workOrderId, total, currency: 'BOB', details: { create: details.map((item) => ({ description: item.description, itemType: item.itemType, quantity: item.quantity, unitPrice: item.unitPrice, subtotal: item.subtotal })) } },
        include: { details: true },
      });
      await tx.workOrder.update({ where: { id: workOrderId }, data: { status: 'PRESUPUESTO_ENVIADO' } });
      return { id: quote.id, workOrderId, items: quote.details.map((item: { id: string; description: string; itemType: string; quantity: Prisma.Decimal; unitPrice: Prisma.Decimal; subtotal: Prisma.Decimal }) => ({ id: item.id, description: item.description, itemType: item.itemType as QuoteItemType, quantity: item.quantity.toString(), unitPrice: item.unitPrice.toString(), subtotal: item.subtotal.toString() })), total: quote.total.toString(), currency: quote.currency, createdAt: quote.createdAt };
    });
  }
}

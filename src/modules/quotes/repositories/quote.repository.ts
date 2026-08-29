import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma } from '../../../generated/prisma/client';
import { CreateQuoteDto } from '../dto/create-quote.dto';
import { QuoteResponseDto } from '../dto/quote-response.dto';

@Injectable()
export class QuoteRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(workOrderId: string, dto: CreateQuoteDto): Promise<QuoteResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const laborItems = dto.laborItems.map((item) => ({ description: item.description, hours: item.hours }));
      const order = await tx.workOrder.findUnique({ where: { id: workOrderId }, select: { id: true, status: true } });
      if (!order) throw new NotFoundException('Work order not found');
      const parts = await tx.sparePart.findMany({ where: { id: { in: dto.partItems.map((item) => item.sparePartId) }, isActive: true } });
      if (parts.length !== new Set(dto.partItems.map((item) => item.sparePartId)).size) throw new NotFoundException('One or more spare parts were not found');
      const laborSubtotal = dto.laborItems.reduce((sum, item) => sum.plus(new Prisma.Decimal(item.hours).mul(120)), new Prisma.Decimal(0));
      const partsSubtotal = dto.partItems.reduce((sum, item) => sum.plus((parts.find((part) => part.id === item.sparePartId)?.unitPrice ?? new Prisma.Decimal(0)).mul(item.quantity)), new Prisma.Decimal(0));
      const quote = await tx.quote.upsert({
        where: { workOrderId },
        update: { laborItems: laborItems as Prisma.InputJsonValue, laborSubtotal, partsSubtotal, total: laborSubtotal.plus(partsSubtotal) },
        create: { workOrderId, laborItems: laborItems as Prisma.InputJsonValue, laborSubtotal, partsSubtotal, total: laborSubtotal.plus(partsSubtotal), parts: { create: dto.partItems.map((item) => { const price = parts.find((part) => part.id === item.sparePartId)?.unitPrice ?? new Prisma.Decimal(0); return { sparePartId: item.sparePartId, quantity: item.quantity, unitPrice: price, subtotal: price.mul(item.quantity) }; }) } },
      });
      await tx.workOrder.update({ where: { id: workOrderId }, data: { status: 'PRESUPUESTO_ENVIADO' } });
      return { id: quote.id, workOrderId: quote.workOrderId, laborItems: quote.laborItems as unknown[], laborSubtotal: quote.laborSubtotal.toString(), partsSubtotal: quote.partsSubtotal.toString(), total: quote.total.toString(), currency: quote.currency, createdAt: quote.createdAt };
    });
  }
}

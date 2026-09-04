import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateQuoteDto, CreateQuoteItemDto, QuoteItemType } from '../dto/create-quote.dto';
import { ApproveQuoteDto } from '../dto/approve-quote.dto';
import { RejectQuoteDto } from '../dto/reject-quote.dto';
import { QuoteDecision, QuoteDecisionResponseDto } from '../dto/quote-decision-response.dto';
import { QuoteResponseDto } from '../dto/quote-response.dto';
import { QuoteApprovalDetailResponseDto } from '../dto/quote-approval-query-response.dto';

@Injectable()
export class QuoteRepository {
  constructor(private readonly prisma: PrismaService) {}

  findOrderForQuote(workOrderId: string) {
    return this.prisma.workOrder.findFirst({ where: { id: workOrderId, diagnostic: { isNot: null } }, select: { status: true } });
  }

  create(workOrderId: string, dto: CreateQuoteDto, laborHourlyRate: Prisma.Decimal): Promise<QuoteResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.workOrder.findUnique({ where: { id: workOrderId }, select: { id: true } });
      if (!order) throw new NotFoundException('Work order not found');

      const partIds = dto.items.filter((item) => item.itemType === QuoteItemType.PART).map((item) => item.sparePartId);
      if (partIds.some((id) => !id)) throw new NotFoundException('Part items require a sparePartId');
      const parts = partIds.length > 0
        ? await tx.sparePart.findMany({ where: { id: { in: partIds as string[] }, isActive: true } })
        : [];

      // BE-12.4 / BE-12.5 (HU-12): dedupe repeated spare parts by merging their
      // quantities, and always resolve the unit price from the official catalog
      // instead of trusting whatever the frontend sent.
      const dedupedItems = this.dedupePartItems(dto.items);
      const details = dedupedItems.map((item) => {
        const quantity = new Prisma.Decimal(item.quantity);
        const catalogPart = item.sparePartId ? parts.find((part) => part.id === item.sparePartId) : undefined;
        if (item.itemType === QuoteItemType.PART && !catalogPart) throw new NotFoundException('Spare part not found');
        // PART -> official catalog price; LABOR -> configured base hourly rate.
        const unitPrice = catalogPart ? catalogPart.unitPrice : laborHourlyRate;
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

  findApprovalPage(page: number, pageSize: number) {
    return this.prisma.quote.findMany({
      where: { workOrder: { status: 'PRESUPUESTO_ENVIADO' } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        workOrderId: true,
        total: true,
        workOrder: {
          select: {
            status: true,
            vehicle: { select: { plate: true, brand: true, model: true, year: true, isFullyElectric: true } },
            customer: { select: { name: true } },
          },
        },
      },
    }).then((rows) => rows.map((row) => ({
      workOrderId: row.workOrderId,
      orderCode: null,
      vehiclePlate: row.workOrder.vehicle.plate,
      vehicleBrand: row.workOrder.vehicle.brand,
      vehicleModel: row.workOrder.vehicle.model,
      vehicleYear: row.workOrder.vehicle.year,
      clientName: row.workOrder.customer.name,
      total: row.total.toString(),
      status: row.workOrder.status,
      isFullyElectric: row.workOrder.vehicle.isFullyElectric,
    })));
  }

  countApprovalQuotes(): Promise<number> {
    return this.prisma.quote.count({ where: { workOrder: { status: 'PRESUPUESTO_ENVIADO' } } });
  }

  async findApprovalDetail(workOrderId: string): Promise<QuoteApprovalDetailResponseDto | null> {
    const quote = await this.prisma.quote.findFirst({
      where: { workOrderId, workOrder: { status: 'PRESUPUESTO_ENVIADO' } },
      select: {
        id: true,
        workOrderId: true,
        total: true,
        laborSubtotal: true,
        partsSubtotal: true,
        currency: true,
        createdAt: true,
        details: { orderBy: { id: 'asc' } },
        parts: { orderBy: { id: 'asc' }, select: { status: true, sparePart: { select: { code: true } } } },
        workOrder: {
          select: {
            id: true,
            status: true,
            initialComplaint: true,
            createdAt: true,
            vehicle: { select: { plate: true, brand: true, model: true, year: true, isFullyElectric: true } },
            customer: { select: { name: true, identification: true, phone: true } },
          },
        },
      },
    });
    if (!quote) return null;

    let partIndex = 0;
    return {
      quoteId: quote.id,
      workOrderId: quote.workOrderId,
      workOrder: {
        id: quote.workOrder.id,
        status: quote.workOrder.status,
        vehiclePlate: quote.workOrder.vehicle.plate,
        vehicleBrand: quote.workOrder.vehicle.brand,
        vehicleModel: quote.workOrder.vehicle.model,
        vehicleYear: quote.workOrder.vehicle.year,
        clientName: quote.workOrder.customer.name,
        clientDocument: quote.workOrder.customer.identification,
        clientPhone: quote.workOrder.customer.phone,
        entryReason: quote.workOrder.initialComplaint,
        createdAt: quote.workOrder.createdAt,
      },
      budget: {
        id: quote.id,
        workOrderId: quote.workOrderId,
        total: quote.total.toString(),
        laborSubtotal: quote.laborSubtotal?.toString() ?? '0',
        partsSubtotal: quote.partsSubtotal?.toString() ?? '0',
        currency: quote.currency,
        status: quote.workOrder.status,
        createdAt: quote.createdAt,
      },
      items: quote.details.map((item) => {
        const part = item.itemType === 'PART' ? quote.parts[partIndex++] : undefined;
        return {
          id: item.id,
          description: item.description,
          itemType: item.itemType as QuoteItemType,
          quantity: item.quantity.toString(),
          unitPrice: item.unitPrice.toString(),
          subtotal: item.subtotal.toString(),
          status: part?.status ?? 'PROPOSED',
          ...(part?.sparePart.code ? { code: part.sparePart.code } : {}),
        };
      }),
      isFullyElectric: quote.workOrder.vehicle.isFullyElectric,
    };
  }

  private dedupePartItems(items: CreateQuoteItemDto[]): CreateQuoteItemDto[] {
    const merged = new Map<string, CreateQuoteItemDto>();
    const result: CreateQuoteItemDto[] = [];
    for (const item of items) {
      if (item.itemType === QuoteItemType.PART && item.sparePartId) {
        const existing = merged.get(item.sparePartId);
        if (existing) {
          existing.quantity += item.quantity;
          continue;
        }
        merged.set(item.sparePartId, item);
        result.push(item);
      } else {
        result.push(item);
      }
    }
    return result;
  }

  findApprovalPage(page: number, pageSize: number) {
    return this.prisma.quote.findMany({
      where: { workOrder: { status: 'PRESUPUESTO_ENVIADO' } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        workOrderId: true,
        total: true,
        workOrder: {
          select: {
            status: true,
            vehicle: { select: { plate: true, brand: true, model: true, year: true, isFullyElectric: true } },
            customer: { select: { name: true } },
          },
        },
      },
    }).then((rows) => rows.map((row) => ({
      workOrderId: row.workOrderId,
      orderCode: null,
      vehiclePlate: row.workOrder.vehicle.plate,
      vehicleBrand: row.workOrder.vehicle.brand,
      vehicleModel: row.workOrder.vehicle.model,
      vehicleYear: row.workOrder.vehicle.year,
      clientName: row.workOrder.customer.name,
      total: row.total.toString(),
      status: row.workOrder.status,
      isFullyElectric: row.workOrder.vehicle.isFullyElectric,
    })));
  }

  countApprovalQuotes(): Promise<number> {
    return this.prisma.quote.count({ where: { workOrder: { status: 'PRESUPUESTO_ENVIADO' } } });
  }

  async findApprovalDetail(workOrderId: string): Promise<QuoteApprovalDetailResponseDto | null> {
    const quote = await this.prisma.quote.findFirst({
      where: { workOrderId, workOrder: { status: 'PRESUPUESTO_ENVIADO' } },
      select: {
        id: true,
        workOrderId: true,
        total: true,
        laborSubtotal: true,
        partsSubtotal: true,
        currency: true,
        createdAt: true,
        details: { orderBy: { id: 'asc' } },
        parts: { orderBy: { id: 'asc' }, select: { status: true, sparePart: { select: { code: true } } } },
        workOrder: {
          select: {
            id: true,
            status: true,
            initialComplaint: true,
            createdAt: true,
            vehicle: { select: { plate: true, brand: true, model: true, year: true, isFullyElectric: true } },
            customer: { select: { name: true, identification: true, phone: true } },
          },
        },
      },
    });
    if (!quote) return null;

    let partIndex = 0;
    return {
      quoteId: quote.id,
      workOrderId: quote.workOrderId,
      workOrder: {
        id: quote.workOrder.id,
        status: quote.workOrder.status,
        vehiclePlate: quote.workOrder.vehicle.plate,
        vehicleBrand: quote.workOrder.vehicle.brand,
        vehicleModel: quote.workOrder.vehicle.model,
        vehicleYear: quote.workOrder.vehicle.year,
        clientName: quote.workOrder.customer.name,
        clientDocument: quote.workOrder.customer.identification,
        clientPhone: quote.workOrder.customer.phone,
        entryReason: quote.workOrder.initialComplaint,
        createdAt: quote.workOrder.createdAt,
      },
      budget: {
        id: quote.id,
        workOrderId: quote.workOrderId,
        total: quote.total.toString(),
        laborSubtotal: quote.laborSubtotal?.toString() ?? '0',
        partsSubtotal: quote.partsSubtotal?.toString() ?? '0',
        currency: quote.currency,
        status: quote.workOrder.status,
        createdAt: quote.createdAt,
      },
      items: quote.details.map((item) => {
        const part = item.itemType === 'PART' ? quote.parts[partIndex++] : undefined;
        return {
          id: item.id,
          description: item.description,
          itemType: item.itemType as QuoteItemType,
          quantity: item.quantity.toString(),
          unitPrice: item.unitPrice.toString(),
          subtotal: item.subtotal.toString(),
          status: part?.status ?? 'PROPOSED',
          ...(part?.sparePart.code ? { code: part.sparePart.code } : {}),
        };
      }),
      isFullyElectric: quote.workOrder.vehicle.isFullyElectric,
    };
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
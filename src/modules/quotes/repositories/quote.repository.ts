import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateQuoteDto, CreateQuoteItemDto, QuoteItemType } from '../dto/create-quote.dto';
import { ApproveQuoteDto } from '../dto/approve-quote.dto';
import { RejectQuoteDto } from '../dto/reject-quote.dto';
import { QuoteDecision, QuoteDecisionResponseDto } from '../dto/quote-decision-response.dto';
import { QuoteResponseDto } from '../dto/quote-response.dto';
import { QuoteApprovalDetailResponseDto } from '../dto/quote-approval-query-response.dto';
import { releaseReservedParts } from '../../work-orders/repositories/reserved-parts-release';

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

      // BE-E06 (HU-21): budget lines are never physically deleted. Before the
      // previous budget is superseded, any part that is still RESERVED for this
      // work order is released back to the available stock in the same
      // transaction (HU-07 / BE-E03). The stock is only released, never newly
      // reserved here.
      await releaseReservedParts(tx, workOrderId);

      const partIds = dto.items.filter((item) => item.itemType === QuoteItemType.PART).map((item) => item.sparePartId);
      if (partIds.some((id) => !id)) throw new NotFoundException('Part items require a sparePartId');
      const parts = partIds.length > 0
        ? await tx.sparePart.findMany({ where: { id: { in: partIds as string[] }, isActive: true } })
        : [];

      // BE-12.4 / BE-12.5 (HU-12): dedupe repeated spare parts by merging their
      // quantities, and always resolve the unit price from the official catalog
      // instead of trusting whatever the frontend sent.
      const dedupedItems = this.dedupePartItems(dto.items);
      // BE-P05 / RN-21: the whole budget is built with Prisma.Decimal. The
      // detail rows keep a Decimal quantity (QuoteDetail.quantity is DECIMAL)
      // and the part rows keep the validated integer (QuotePart.quantity is a
      // SMALLINT), so no Decimal -> Number -> Decimal round trip is performed.
      const details: Array<{
        description: string;
        itemType: QuoteItemType;
        quantity: Prisma.Decimal;
        unitPrice: Prisma.Decimal;
        subtotal: Prisma.Decimal;
        sparePartId?: string;
      }> = [];
      const partItems: Array<{
        sparePartId: string;
        quantity: number;
        unitPrice: Prisma.Decimal;
        subtotal: Prisma.Decimal;
      }> = [];
      for (const item of dedupedItems) {
        const quantity = new Prisma.Decimal(item.quantity);
        const catalogPart = item.sparePartId ? parts.find((part) => part.id === item.sparePartId) : undefined;
        if (item.itemType === QuoteItemType.PART && !catalogPart) throw new NotFoundException('Spare part not found');
        // PART -> official catalog price; LABOR -> configured base hourly rate.
        const unitPrice = catalogPart ? catalogPart.unitPrice : laborHourlyRate;
        const subtotal = quantity.mul(unitPrice);
        details.push({
          description: item.description,
          itemType: item.itemType,
          quantity,
          unitPrice,
          subtotal,
          ...(item.sparePartId ? { sparePartId: item.sparePartId } : {}),
        });
        if (item.itemType === QuoteItemType.PART && item.sparePartId) {
          // BE-P05: line subtotal computed with Decimal.mul() over the guarded
          // integer quantity; the quantity never crosses through a JS Number.
          partItems.push({
            sparePartId: item.sparePartId as string,
            quantity: item.quantity,
            unitPrice,
            subtotal: unitPrice.mul(item.quantity),
          });
        }
      }
      const total = details.reduce((sum, item) => sum.plus(item.subtotal), new Prisma.Decimal(0));
      const laborSubtotal = details.filter((item) => item.itemType === QuoteItemType.LABOR).reduce((sum, item) => sum.plus(item.subtotal), new Prisma.Decimal(0));
      const partsSubtotal = details.filter((item) => item.itemType === QuoteItemType.PART).reduce((sum, item) => sum.plus(item.subtotal), new Prisma.Decimal(0));
      const quote = await this.persistQuoteLines(
        tx,
        workOrderId,
        details,
        partItems,
        { total, laborSubtotal, partsSubtotal },
      );
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
        details: { where: { status: 'ACTIVE' }, orderBy: { id: 'asc' } },
        parts: { where: { status: { in: ['PROPOSED', 'RESERVED', 'RELEASED'] } }, orderBy: { id: 'asc' }, select: { status: true, sparePart: { select: { code: true } } } },
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

  // BE-E06 / HU-21: append-only budget persistence. If the work order already
  // has a quote, its active lines are superseded (SUPERSEDED, never deleted)
  // and the new lines are appended as PROPOSED/ACTIVE; INSTALLED parts and
  // already-superseded rows are left untouched. Otherwise the quote is created
  // from scratch. Returns the active detail rows for the response mapping.
  private async persistQuoteLines(
    tx: Prisma.TransactionClient,
    workOrderId: string,
    details: Array<{
      description: string;
      itemType: QuoteItemType;
      quantity: Prisma.Decimal;
      unitPrice: Prisma.Decimal;
      subtotal: Prisma.Decimal;
      sparePartId?: string;
    }>,
    partItems: Array<{
      sparePartId: string;
      quantity: number;
      unitPrice: Prisma.Decimal;
      subtotal: Prisma.Decimal;
    }>,
    totals: { total: Prisma.Decimal; laborSubtotal: Prisma.Decimal; partsSubtotal: Prisma.Decimal },
  ) {
    const detailRows = details.map((item) => ({
      description: item.description,
      itemType: item.itemType,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.subtotal,
    }));
    const partRows = partItems.map((item) => ({
      sparePartId: item.sparePartId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.subtotal,
    }));

    const existing = await tx.quote.findUnique({ where: { workOrderId }, select: { id: true } });
    if (existing) {
      // Re-quote: supersede every live line of the previous budget (except
      // INSTALLED parts that were physically consumed and rows already
      // superseded) and append the new proposal as the active one.
      return tx.quote.update({
        where: { id: existing.id },
        data: {
          total: totals.total,
          laborSubtotal: totals.laborSubtotal,
          partsSubtotal: totals.partsSubtotal,
          currency: 'BOB',
          details: {
            updateMany: { where: { status: 'ACTIVE' }, data: { status: 'SUPERSEDED' } },
            create: detailRows,
          },
          parts: {
            updateMany: { where: { status: { notIn: ['INSTALLED', 'SUPERSEDED'] } }, data: { status: 'SUPERSEDED' } },
            create: partRows,
          },
        },
        include: { details: { where: { status: 'ACTIVE' }, orderBy: { id: 'asc' } } },
      });
    }

    return tx.quote.create({
      data: {
        workOrderId,
        total: totals.total,
        laborSubtotal: totals.laborSubtotal,
        partsSubtotal: totals.partsSubtotal,
        currency: 'BOB',
        details: { create: detailRows },
        parts: { create: partRows },
      },
      include: { details: { where: { status: 'ACTIVE' }, orderBy: { id: 'asc' } } },
    });
  }

  approve(workOrderId: string, dto: ApproveQuoteDto, recordedBy: string): Promise<QuoteDecisionResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const quote = await tx.quote.findUnique({
        where: { workOrderId },
        select: { id: true, workOrder: { select: { id: true, vehicleId: true, mechanicId: true, status: true } }, parts: { where: { status: 'PROPOSED' }, select: { id: true, sparePartId: true, quantity: true, status: true } }, approvals: { select: { id: true } } },
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

      // HU-07 / BE-E03: defensively release any part still RESERVED for this
      // work order before unconditionally marking all lines as RELEASED. In the
      // normal flow parts are still PROPOSED so the helper is a harmless no-op,
      // but if the OT somehow retained a reservation it is freed atomically.
      await releaseReservedParts(tx, workOrderId);

      // BE-E06 / HU-21: only live (PROPOSED/RESERVED) lines are closed as
      // RELEASED. SUPERSEDED history and INSTALLED parts that were already
      // consumed are left untouched.
      await tx.quotePart.updateMany({
        where: { quoteId: quote.id, status: { in: ['PROPOSED', 'RESERVED'] } },
        data: { status: 'RELEASED' },
      });
      await tx.workOrder.update({ where: { id: workOrderId }, data: { status: 'RECHAZADO' } });
      await tx.technicalHistory.create({ data: { vehicleId: quote.workOrder.vehicleId, description: `Quote rejected for work order ${workOrderId}: ${dto.reason}` } });
      const approval = await tx.quoteApproval.create({ data: { quoteId: quote.id, decision: QuoteDecision.REJECTED, reason: dto.reason, recordedBy } });
      return { id: approval.id, quoteId: approval.quoteId, workOrderId, decision: QuoteDecision.REJECTED, reason: dto.reason, createdAt: approval.createdAt };
    });
  }
}

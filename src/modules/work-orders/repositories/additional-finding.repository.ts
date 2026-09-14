import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma } from '../../../generated/prisma/client';
import { CreateDiagnosticDto } from '../dto/create-diagnostic.dto';
import { DiagnosticResponseDto } from '../dto/diagnostic-response.dto';
import { ApproveAdditionalFindingDto } from '../dto/approve-additional-finding.dto';
import { RejectAdditionalFindingDto } from '../dto/reject-additional-finding.dto';
import { AdditionalFindingResponseDto } from '../dto/additional-finding.response.dto';
import { WorkOrderStatus } from '../../../common/enums/work-order-status.enum';

@Injectable()
export class AdditionalFindingRepository {
  constructor(private readonly prisma: PrismaService) {}

  // HU-11: persist a technical diagnostic. When the order is already under
  // repair (status QUOTE_SENT, RN-03), the reported finding is also
  // captured as an AdditionalFinding annex so reception can approve or reject
  // the supplementary budget (US-21). reportedBy is the authenticated mechanic
  // passed by the service (BE-19).
  createDiagnostic(id: string, dto: CreateDiagnosticDto, status: string, reportedBy?: string): Promise<DiagnosticResponseDto> {
    return this.prisma.$transaction(async (transaction) => {
      const diagnostic = await transaction.diagnostic.upsert({
        where: { workOrderId: id },
        update: { description: dto.description, suggestedTasks: dto.suggestedTasks, suggestedPartIds: dto.suggestedPartIds, estimatedHours: dto.estimatedHours },
        create: { workOrderId: id, description: dto.description, suggestedTasks: dto.suggestedTasks, suggestedPartIds: dto.suggestedPartIds, estimatedHours: dto.estimatedHours },
      });
      const order = await transaction.workOrder.update({ where: { id }, data: { status }, select: { vehicleId: true } });
      await transaction.technicalHistory.create({ data: { vehicleId: order.vehicleId, description: `Diagnostic recorded for work order ${id}: ${dto.description}` } });
      // US-21 / RN-03: an unforeseen finding reported during repair becomes a
      // pending additional-quote annex for the reception to decide.
      if (status === WorkOrderStatus.QUOTE_SENT && reportedBy) {
        await transaction.additionalFinding.create({
          data: {
            workOrderId: id,
            description: dto.description,
            suggestedTasks: dto.suggestedTasks,
            suggestedPartIds: dto.suggestedPartIds,
            estimatedHours: dto.estimatedHours,
            reportedBy,
          },
        });
      }
      // RN-16: return an explicit allowlist. Never serialize the Prisma entity
      // into a mechanic-facing response, so future financial fields cannot leak.
      return {
        id: diagnostic.id,
        workOrderId: diagnostic.workOrderId,
        description: diagnostic.description,
        suggestedTasks: diagnostic.suggestedTasks as string[],
        suggestedPartIds: diagnostic.suggestedPartIds as string[],
        estimatedHours: Number(diagnostic.estimatedHours),
        createdAt: diagnostic.createdAt,
      };
    });
  }

  // US-21 (BE-T21.1): light read that lets the service validate that the work
  // order is waiting for the reception decision and owns a pending annex,
  // before the transactional approve/reject runs (defense in depth, BE-16).
  findAdditionalFindingContext(workOrderId: string) {
    return this.prisma.workOrder.findUnique({
      where: { id: workOrderId },
      select: {
        id: true,
        status: true,
        additionalFindings: {
          where: { status: 'PENDING_QUOTE' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, description: true },
        },
      },
    });
  }

  private toAdditionalFindingResponse(finding: {
    id: string;
    workOrderId: string;
    description: string;
    suggestedTasks: Prisma.JsonValue;
    suggestedPartIds: Prisma.JsonValue;
    estimatedHours: Prisma.Decimal;
    status: string;
    reportedBy: string;
    decidedBy: string | null;
    decidedAt: Date | null;
    channel: string | null;
    customerName: string | null;
    notes: string | null;
    rejectionReason: string | null;
    createdAt: Date;
  }): AdditionalFindingResponseDto {
    return {
      id: finding.id,
      workOrderId: finding.workOrderId,
      description: finding.description,
      suggestedTasks: finding.suggestedTasks as string[],
      suggestedPartIds: finding.suggestedPartIds as string[],
      estimatedHours: Number(finding.estimatedHours),
      status: finding.status,
      reportedBy: finding.reportedBy,
      decidedBy: finding.decidedBy,
      decidedAt: finding.decidedAt,
      channel: finding.channel,
      customerName: finding.customerName,
      notes: finding.notes,
      rejectionReason: finding.rejectionReason,
      createdAt: finding.createdAt,
    };
  }

  // US-21 (BE-T21.2, HU-09, RN-07, RN-19): approve the additional quote of an
  // unforeseen finding. Inside a single transaction the suggested spare parts
  // are priced from the catalog, reserved against available stock (RN-07), the
  // active quote is extended (NEW QuotePart/QuoteDetail rows + totals, the
  // original lines are never modified), the annex is marked APPROVED with the
  // contact channel, the order resumes IN_REPAIR and the immutable
  // technical history and mechanic notification are recorded (BE-16 / BE-17).
  approveAdditionalFinding(
    workOrderId: string,
    dto: ApproveAdditionalFindingDto,
    userId: string,
    laborHourlyRate: Prisma.Decimal,
  ): Promise<AdditionalFindingResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.workOrder.findUnique({
        where: { id: workOrderId },
        select: {
          id: true,
          status: true,
          vehicleId: true,
          mechanicId: true,
          quote: {
            select: {
              id: true,
              laborSubtotal: true,
              partsSubtotal: true,
              total: true,
              parts: {
                // BE-E06 / HU-21: only live part lines take part in the annex
                // extension; SUPERSEDED history and consumed parts are ignored.
                where: { status: { notIn: ['SUPERSEDED', 'INSTALLED'] } },
                select: { id: true, sparePartId: true, quantity: true, unitPrice: true, status: true },
              },
            },
          },
          additionalFindings: {
            where: { status: 'PENDING_QUOTE' },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });
      if (!order) throw new NotFoundException('Work order not found');
      if (order.status !== WorkOrderStatus.QUOTE_SENT) {
        throw new ConflictException('Work order is not awaiting an additional budget approval');
      }
      const finding = order.additionalFindings[0];
      if (!finding) throw new ConflictException('Work order has no additional finding awaiting a decision');
      if (!order.quote) throw new ConflictException('Work order has no active quote to extend');

      // Suggested part quantities: the same part repeated in the mechanic's
      // list is treated as that many units (dedup via the catalog upsert).
      const suggestedPartIds = finding.suggestedPartIds as string[];
      const quantityById = new Map<string, number>();
      for (const partId of suggestedPartIds) {
        quantityById.set(partId, (quantityById.get(partId) ?? 0) + 1);
      }
      const catalogParts =
        quantityById.size > 0
          ? await tx.sparePart.findMany({ where: { id: { in: [...quantityById.keys()] }, isActive: true } })
          : [];
      if (catalogParts.length !== quantityById.size) {
        throw new NotFoundException('A suggested spare part does not exist or is inactive');
      }

      const currentPartsBySparePartId = new Map(
        order.quote.parts.map((part) => [part.sparePartId, part] as const),
      );
      let partsDelta = new Prisma.Decimal(0);
      for (const [partId, quantity] of quantityById.entries()) {
        const sparePart = catalogParts.find((part) => part.id === partId)!;
        const subtotal = sparePart.unitPrice.mul(quantity);
        partsDelta = partsDelta.plus(subtotal);

        // RN-07: reserve only from the currently available stock (guarded).
        const reserved = await tx.sparePart.updateMany({
          where: { id: partId, isActive: true, availableStock: { gte: quantity } },
          data: { availableStock: { decrement: quantity }, reservedStock: { increment: quantity } },
        });
        if (reserved.count !== 1) {
          throw new UnprocessableEntityException('Insufficient available stock for a suggested spare part');
        }

        const existingQuotePart = currentPartsBySparePartId.get(partId);
        if (existingQuotePart) {
          const newQuantity = existingQuotePart.quantity + quantity;
          await tx.quotePart.update({
            where: { id: existingQuotePart.id },
            data: { quantity: newQuantity, subtotal: existingQuotePart.unitPrice.mul(newQuantity), status: 'RESERVED' },
          });
        } else {
          await tx.quotePart.create({
            data: { quoteId: order.quote.id, sparePartId: partId, quantity, unitPrice: sparePart.unitPrice, subtotal, status: 'RESERVED' },
          });
        }
        await tx.quoteDetail.create({
          data: {
            quoteId: order.quote.id,
            description: `Additional finding: ${sparePart.name}`,
            itemType: 'PART',
            quantity: new Prisma.Decimal(quantity),
            unitPrice: sparePart.unitPrice,
            subtotal,
          },
        });
      }

      // Labor item for the unforeseen finding priced at the official rate.
      // BE-P05 / RN-21: finding.estimatedHours is already a Prisma.Decimal, so
      // it is used directly without a Number round trip (exact hour arithmetic).
      const laborHours = finding.estimatedHours;
      const laborDelta = laborHours.mul(laborHourlyRate);
      if (laborHours.greaterThan(0)) {
        await tx.quoteDetail.create({
          data: {
            quoteId: order.quote.id,
            description: `Additional finding: ${finding.description} (labor)`,
            itemType: 'LABOR',
            quantity: laborHours,
            unitPrice: laborHourlyRate,
            subtotal: laborDelta,
          },
        });
      }

      await tx.quote.update({
        where: { id: order.quote.id },
        data: {
          laborSubtotal: (order.quote.laborSubtotal ?? new Prisma.Decimal(0)).plus(laborDelta),
          partsSubtotal: (order.quote.partsSubtotal ?? new Prisma.Decimal(0)).plus(partsDelta),
          total: order.quote.total.plus(laborDelta).plus(partsDelta),
        },
      });

      const approved = await tx.additionalFinding.update({
        where: { id: finding.id },
        data: {
          status: 'APPROVED',
          decidedBy: userId,
          decidedAt: new Date(),
          channel: dto.channel,
          customerName: dto.customerName,
          notes: dto.notes,
        },
      });

      await tx.workOrder.update({ where: { id: workOrderId }, data: { status: WorkOrderStatus.IN_REPAIR } });
      await tx.technicalHistory.create({
        data: {
          vehicleId: order.vehicleId,
          description: `Additional finding approved for work order ${workOrderId}: ${finding.description}. Order resumes repair.`,
        },
      });
      if (order.mechanicId) {
        await tx.notification.create({
          data: {
            recipientId: order.mechanicId,
            workOrderId,
            type: 'ADDITIONAL_FINDING_APPROVED',
            message: `The additional quote of work order ${workOrderId} was approved. Resume the repair with the supplementary work`,
          },
        });
      }
      return this.toAdditionalFindingResponse(approved);
    });
  }

  // US-21 (BE-T21.2, RN-19): reject the additional quote. The annex is archived
  // with the permanent label "Daño no reparado por decisión del cliente", the
  // order resumes IN_REPAIR and the mechanic is notified that only the
  // originally approved work continues. No stock was reserved for a pending
  // annex, so nothing is released.
  rejectAdditionalFinding(
    workOrderId: string,
    dto: RejectAdditionalFindingDto,
    userId: string,
  ): Promise<AdditionalFindingResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.workOrder.findUnique({
        where: { id: workOrderId },
        select: {
          id: true,
          status: true,
          vehicleId: true,
          mechanicId: true,
          additionalFindings: {
            where: { status: 'PENDING_QUOTE' },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });
      if (!order) throw new NotFoundException('Work order not found');
      if (order.status !== WorkOrderStatus.QUOTE_SENT) {
        throw new ConflictException('Work order is not awaiting an additional budget approval');
      }
      const finding = order.additionalFindings[0];
      if (!finding) throw new ConflictException('Work order has no additional finding awaiting a decision');

      const rejected = await tx.additionalFinding.update({
        where: { id: finding.id },
        data: { status: 'REJECTED', decidedBy: userId, decidedAt: new Date(), rejectionReason: dto.reason },
      });

      await tx.workOrder.update({ where: { id: workOrderId }, data: { status: WorkOrderStatus.IN_REPAIR } });
      await tx.technicalHistory.create({
        data: {
          vehicleId: order.vehicleId,
          description:
            `Daño no reparado por decisión del cliente. Work order ${workOrderId}: ${finding.description}. Reason: ${dto.reason}`,
        },
      });
      if (order.mechanicId) {
        await tx.notification.create({
          data: {
            recipientId: order.mechanicId,
            workOrderId,
            type: 'ADDITIONAL_FINDING_REJECTED',
            message: `The additional quote of work order ${workOrderId} was rejected. Continue with the originally approved work only`,
          },
        });
      }
      return this.toAdditionalFindingResponse(rejected);
    });
  }
}
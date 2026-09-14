import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma } from '../../../generated/prisma/client';
import { RegisterVehicleEntryDto, WorkOrderResponseDto } from '../dto/register-vehicle-entry.dto';
import { DeliverWorkOrderDto } from '../dto/deliver-work-order.dto';
import { DeliverWorkOrderResponseDto } from '../dto/deliver-work-order.response.dto';
import { AssignWorkOrderResponseDto } from '../dto/assign-work-order.dto';
import { CreateDiagnosticDto } from '../dto/create-diagnostic.dto';
import { DiagnosticResponseDto } from '../dto/diagnostic-response.dto';
import { ConsumeSparePartDto } from '../dto/consume-spare-part.dto';
import { ReturnSparePartDto } from '../dto/return-spare-part.dto';
import { WorkOrderPartResponseDto } from '../dto/work-order-part.response.dto';
import { releaseReservedParts } from './reserved-parts-release';
import { SetAwaitingPartDto } from '../dto/set-awaiting-part.dto';
import { AwaitingPartResponseDto } from '../dto/awaiting-part-response.dto';
import { CompleteWorkOrderDto } from '../dto/complete-work-order.dto';
import { CompleteWorkOrderResponseDto } from '../dto/complete-work-order.response.dto';
import { ApplyDiscountDto } from '../dto/apply-discount.dto';
import { VoidAdjustmentDto } from '../dto/void-adjustment.dto';
import { SettlementAdjustmentResponseDto, AdjustmentType } from '../dto/settlement-adjustment.response.dto';
import { ApproveAdditionalFindingDto } from '../dto/approve-additional-finding.dto';
import { RejectAdditionalFindingDto } from '../dto/reject-additional-finding.dto';
import { AdditionalFindingResponseDto } from '../dto/additional-finding.response.dto';

export interface AvailableWorkOrderRow {
  id: string;
  vehicleId: string;
  plate: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleYear: number;
  customerName: string;
  customerIdentification: string;
  initialComplaint: string;
  status: string;
  createdAt: Date;
  mechanicId: string | null;
}

// BE-T05.2: row for the tracking summary. Suspension data (pending discrepancy
// and quote creation date) is read so the service can derive the pause reason
// and the days waiting for customer approval.
export interface WorkOrderTrackingRow {
  id: string;
  status: string;
  createdAt: Date;
  plate: string;
  model: string;
  customerPhone: string | null;
  mechanicName: string | null;
  bayId: string | null;
  bayNumber: number | null;
  quoteCreatedAt: Date | null;
  discrepancy: { sparePartName: string; pausedReason: string } | null;
  // US-21 / BE-T21.1: description of the latest additional finding that is
  // still awaiting the reception decision (RN-03).
  additionalFindingDescription: string | null;
}

// BE-T05.3: only these terminal states count as a previous delivered visit.
// FINALIZADO is the legacy closed state; ENTREGADO is the delivered state.
const DELIVERED_WORK_ORDER_STATUSES: string[] = ['ENTREGADO', 'FINALIZADO'];

export interface VehicleHistoryRow {
  id: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
  isFullyElectric: boolean;
  customerId: string;
  customer: { id: string; identification: string; name: string; phone: string | null };
  technicalHistory: { id: string; description: string; createdAt: Date }[];
  workOrders: {
    id: string;
    status: string;
    createdAt: Date;
    diagnostic: {
      id: string;
      description: string;
      suggestedTasks: Prisma.JsonValue;
      estimatedHours: Prisma.Decimal;
      createdAt: Date;
    } | null;
    stockMovements: {
      quantity: number;
      createdAt: Date;
      sparePart: { id: string; code: string; name: string };
    }[];
  }[];
}

export interface ActiveMechanicRow {
  id: string;
  isActive: boolean;
  name: string | null;
}

@Injectable()
export class WorkOrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAssignedWorkOrder(id: string, mechanicId: string) {
    return this.prisma.workOrder.findFirst({ where: { id, mechanicId }, select: { status: true } });
  }

  // HU-12: the advisor (WORKSHOP_LEAD / RECEPTIONIST) reads the diagnostic of a
  // work order before building a quote. Non-financial allowlist only (RN-16).
  findDiagnostic(workOrderId: string): Promise<{
    id: string;
    status: string;
    vehicleId: string;
    diagnostic: {
      id: string;
      workOrderId: string;
      description: string;
      suggestedTasks: Prisma.JsonValue;
      suggestedPartIds: Prisma.JsonValue;
      estimatedHours: Prisma.Decimal;
      createdAt: Date;
    } | null;
  } | null> {
    return this.prisma.workOrder.findUnique({
      where: { id: workOrderId },
      select: {
        id: true,
        status: true,
        vehicleId: true,
        diagnostic: {
          select: {
            id: true,
            workOrderId: true,
            description: true,
            suggestedTasks: true,
            suggestedPartIds: true,
            estimatedHours: true,
            createdAt: true,
          },
        },
      },
    });
  }

  // HU-12: list work orders awaiting a quote (EN_DIAGNOSTICO). No monetary
  // fields are exposed to the advisor list (RN-16).
  findPendingQuoteOrders() {
    return this.prisma.workOrder.findMany({
      where: { status: 'EN_DIAGNOSTICO' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        vehicleId: true,
        initialComplaint: true,
        createdAt: true,
        vehicle: { select: { plate: true, brand: true, model: true, year: true } },
        customer: { select: { name: true, identification: true } },
      },
    });
  }

  findAvailable(page: number, pageSize: number): Promise<AvailableWorkOrderRow[]> {
    return this.prisma.workOrder.findMany({
      where: { status: 'RECIBIDO', mechanicId: null },
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        vehicleId: true,
        status: true,
        initialComplaint: true,
        createdAt: true,
        mechanicId: true,
        vehicle: {
          select: {
            plate: true,
            brand: true,
            model: true,
            year: true,
            customer: { select: { name: true, identification: true } },
          },
        },
      },
    }).then((rows) => rows.map((row) => ({
      id: row.id,
      vehicleId: row.vehicleId,
      plate: row.vehicle.plate,
      vehicleBrand: row.vehicle.brand,
      vehicleModel: row.vehicle.model,
      vehicleYear: row.vehicle.year,
      customerName: row.vehicle.customer.name,
      customerIdentification: row.vehicle.customer.identification,
      initialComplaint: row.initialComplaint,
      status: row.status,
      createdAt: row.createdAt,
      mechanicId: row.mechanicId,
    })));
  }

  countAvailable(): Promise<number> {
    return this.prisma.workOrder.count({ where: { status: 'RECIBIDO', mechanicId: null } });
  }

  async findActiveMechanics(page: number, pageSize: number): Promise<ActiveMechanicRow[]> {
    const mechanics = await this.prisma.mechanic.findMany({
      where: { isActive: true },
      orderBy: { id: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { id: true, isActive: true },
    });
    if (mechanics.length === 0) return [];

    const users = await this.prisma.user.findMany({
      where: { id: { in: mechanics.map((m) => m.id) } },
      select: { id: true, fullName: true },
    });
    const nameByUserId = new Map(users.map((u) => [u.id, u.fullName]));

    return mechanics.map((m) => ({ ...m, name: nameByUserId.get(m.id) ?? null }));
  }

  countActiveMechanics(): Promise<number> {
    return this.prisma.mechanic.count({ where: { isActive: true } });
  }

  // US-05 / BE-T05.3: previous delivered work orders of a vehicle with their
  // immutable diagnosis, installed spare parts (kardex OUT movements) and dates
  // (RN-19). Active orders are intentionally excluded from the history.
  async findVehicleHistory(plate: string): Promise<VehicleHistoryRow | null> {
    return this.prisma.vehicle.findUnique({
      where: { plate },
      select: {
        id: true,
        plate: true,
        brand: true,
        model: true,
        year: true,
        isFullyElectric: true,
        customerId: true,
        customer: { select: { id: true, identification: true, name: true, phone: true } },
        technicalHistory: {
          orderBy: { createdAt: 'desc' },
          select: { id: true, description: true, createdAt: true },
        },
        workOrders: {
          where: { status: { in: DELIVERED_WORK_ORDER_STATUSES } },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            status: true,
            createdAt: true,
            diagnostic: {
              select: {
                id: true,
                description: true,
                suggestedTasks: true,
                estimatedHours: true,
                createdAt: true,
              },
            },
            stockMovements: {
              where: { type: 'OUT' },
              orderBy: { createdAt: 'asc' },
              select: {
                quantity: true,
                createdAt: true,
                sparePart: { select: { id: true, code: true, name: true } },
              },
            },
          },
        },
      },
    });
  }

  // US-05 / BE-T05.1: tracking summary filtered by license plate, status or
  // physical bay. Mechanic names are resolved from the users table because
  // Mechanic.id doubles as User.id (seed convention), mirroring the bay
  // monitoring query (US-18).
  //
  // US-16 / RN-06 (BE-T16.3): when the service passes a staleQuoteCutoff, the
  // query filters at the database to PRESUPUESTO_ENVIADO orders whose quote was
  // emitted before that date (15+ days waiting approval).
  async findTrackingSummary(filters: {
    licensePlate?: string;
    status?: string;
    workBayId?: string;
    staleQuoteCutoff?: Date;
  }): Promise<WorkOrderTrackingRow[]> {
    const orders = await this.prisma.workOrder.findMany({
      where: {
        ...(filters.licensePlate ? { vehicle: { is: { plate: filters.licensePlate } } } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.workBayId ? { currentBay: { is: { id: filters.workBayId } } } : {}),
        ...(filters.staleQuoteCutoff
          ? {
              status: 'PRESUPUESTO_ENVIADO',
              quote: { is: { createdAt: { lte: filters.staleQuoteCutoff } } },
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        createdAt: true,
        vehicle: { select: { plate: true, model: true } },
        customer: { select: { phone: true } },
        mechanic: { select: { id: true } },
        currentBay: { select: { id: true, bayNumber: true } },
        quote: { select: { createdAt: true } },
        inventoryDiscrepancies: {
          where: { status: 'PENDING' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { reason: true, sparePart: { select: { name: true } } },
        },
        additionalFindings: {
          where: { status: 'PENDING_QUOTE' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { description: true },
        },
      },
    });

    const mechanicIds = orders
      .map((order) => order.mechanic?.id)
      .filter((id): id is string => Boolean(id));
    const nameByUserId = new Map<string, string>();
    if (mechanicIds.length > 0) {
      const users = await this.prisma.user.findMany({
        where: { id: { in: mechanicIds } },
        select: { id: true, fullName: true },
      });
      users.forEach((user) => nameByUserId.set(user.id, user.fullName));
    }

    return orders.map((order) => {
      const discrepancy = order.inventoryDiscrepancies[0];
      const pendingFinding = order.additionalFindings?.[0];
      return {
        id: order.id,
        status: order.status,
        createdAt: order.createdAt,
        plate: order.vehicle.plate,
        model: order.vehicle.model,
        customerPhone: order.customer.phone,
        mechanicName: order.mechanic ? nameByUserId.get(order.mechanic.id) ?? null : null,
        bayId: order.currentBay?.id ?? null,
        bayNumber: order.currentBay?.bayNumber ?? null,
        quoteCreatedAt: order.quote?.createdAt ?? null,
        discrepancy:
          discrepancy && discrepancy.sparePart
            ? { sparePartName: discrepancy.sparePart.name, pausedReason: discrepancy.reason }
            : null,
        additionalFindingDescription: pendingFinding?.description ?? null,
      };
    });
  }

  createVehicleEntry(dto: RegisterVehicleEntryDto, receptionistId: string): Promise<WorkOrderResponseDto> {
    return this.prisma.$transaction(async (transaction) => {
      const customer = await transaction.customer.upsert({
        where: { identification: dto.customer.identification },
        update: { name: dto.customer.name, phone: dto.customer.phone },
        create: { identification: dto.customer.identification, name: dto.customer.name, phone: dto.customer.phone },
      });
      const vehicle = await transaction.vehicle.upsert({
        where: { plate: dto.plate },
        update: { brand: dto.vehicle.brand, model: dto.vehicle.model, year: dto.vehicle.year },
        create: { customerId: customer.id, plate: dto.plate, brand: dto.vehicle.brand, model: dto.vehicle.model, year: dto.vehicle.year, isFullyElectric: dto.vehicle.isFullyElectric },
      });
      const workOrder = await transaction.workOrder.create({
        data: { vehicleId: vehicle.id, customerId: vehicle.customerId, receptionistId, initialComplaint: dto.initialComplaint },
        select: { id: true, vehicleId: true, customerId: true, status: true, initialComplaint: true, createdAt: true },
      });
      await transaction.technicalHistory.create({
        data: {
          vehicleId: vehicle.id,
          description: `Initial state: ${workOrder.status}. Initial complaint: ${workOrder.initialComplaint}`,
        },
      });
      return workOrder;
    });
  }

  assign(id: string, mechanicId: string): Promise<AssignWorkOrderResponseDto> {
    return this.prisma.$transaction(async (transaction) => {
      const order = await transaction.workOrder.findUnique({ where: { id } });
      if (!order) throw new NotFoundException('Work order not found');
      if (order.mechanicId || order.status !== 'RECIBIDO') throw new Error('Work order is not assignable');
      const mechanic = await transaction.mechanic.findUnique({ where: { id: mechanicId } });
      if (!mechanic) throw new NotFoundException('Mechanic not found');
      if (!mechanic.isActive) throw new Error('Mechanic cannot receive work orders');
      const assignedOrder = await transaction.workOrder.update({
        where: { id },
        data: { mechanicId, assignedAt: new Date(), status: 'ASIGNADA' },
        select: { id: true, mechanicId: true, status: true, updatedAt: true },
      });
      return { ...assignedOrder, mechanicId: assignedOrder.mechanicId as string };
    });
  }

  // HU-11: persist a technical diagnostic. When the order is already under
  // repair (status PRESUPUESTO_ENVIADO, RN-03), the reported finding is also
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
      if (status === 'PRESUPUESTO_ENVIADO' && reportedBy) {
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
  // contact channel, the order resumes EN_REPARACION and the immutable
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
      if (order.status !== 'PRESUPUESTO_ENVIADO') {
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

      await tx.workOrder.update({ where: { id: workOrderId }, data: { status: 'EN_REPARACION' } });
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
  // order resumes EN_REPARACION and the mechanic is notified that only the
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
      if (order.status !== 'PRESUPUESTO_ENVIADO') {
        throw new ConflictException('Work order is not awaiting an additional budget approval');
      }
      const finding = order.additionalFindings[0];
      if (!finding) throw new ConflictException('Work order has no additional finding awaiting a decision');

      const rejected = await tx.additionalFinding.update({
        where: { id: finding.id },
        data: { status: 'REJECTED', decidedBy: userId, decidedAt: new Date(), rejectionReason: dto.reason },
      });

      await tx.workOrder.update({ where: { id: workOrderId }, data: { status: 'EN_REPARACION' } });
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

  // HU-07: read context needed to validate a part consumption without
  // duplicating the transactional stock guard. Returns ownership, status and
  // the reserved quote part lines (never financial fields).
  findConsumeContext(workOrderId: string) {
    return this.prisma.workOrder.findUnique({
      where: { id: workOrderId },
      select: {
        id: true,
        status: true,
        mechanicId: true,
        vehicleId: true,
        quote: {
          select: {
            parts: {
              select: {
                id: true,
                sparePartId: true,
                quantity: true,
                status: true,
                sparePart: { select: { code: true, name: true } },
              },
            },
          },
        },
      },
    });
  }

  // HU-07 / BE-16 / RN-08: atomically consume a reserved spare part. The stock
  // decrement (physical + reserved), the INSTALLED status change, the work
  // order state transition and the immutable kardex record all run inside a
  // single Prisma transaction. RN-01 is enforced with an atomic guarded update
  // so the physical stock can never become negative.
  consumePart(
    workOrderId: string,
    dto: ConsumeSparePartDto,
    userId: string,
    nextStatus: string,
  ): Promise<WorkOrderPartResponseDto> {
    return this.prisma.$transaction(async (transaction) => {
      const order = await transaction.workOrder.findUnique({
        where: { id: workOrderId },
        select: {
          id: true,
          status: true,
          vehicleId: true,
          quote: {
            select: {
              parts: {
                where: { id: dto.workOrderPartId ?? dto.quotePartId },
                select: {
                  id: true,
                  sparePartId: true,
                  quantity: true,
                  status: true,
                  sparePart: { select: { code: true, name: true } },
                },
              },
            },
          },
        },
      });
      const part = order?.quote?.parts?.[0];
      if (!order || !part) throw new NotFoundException('Work order not found');
      // RN-07: the part must already be reserved for this work order.
      if (part.status !== 'RESERVED') {
        throw new UnprocessableEntityException('RN-07: spare part is not reserved for this work order');
      }
      const consumed = await transaction.stockMovement.aggregate({
        _sum: { quantity: true },
        where: { workOrderId, sparePartId: part.sparePartId, type: 'OUT' },
      });
      const consumedQuantity = consumed._sum.quantity ?? 0;
      const pendingQuantity = part.quantity - consumedQuantity;
      if (dto.quantity > pendingQuantity) {
        throw new UnprocessableEntityException('RN-01: quantity exceeds the reserved amount pending for the spare part');
      }
      // RN-08 + RN-01: guarded atomic decrement of physical and reserved stock.
      // The update only matches when both stocks are sufficient, preventing a
      // negative balance at the database level.
      const stockUpdate = await transaction.sparePart.updateMany({
        where: {
          id: part.sparePartId,
          physicalStock: { gte: dto.quantity },
          reservedStock: { gte: dto.quantity },
        },
        data: {
          physicalStock: { decrement: dto.quantity },
          reservedStock: { decrement: dto.quantity },
          availableStock: { decrement: dto.quantity },
          lastMovementAt: new Date(),
        },
      });
      if (stockUpdate.count !== 1) {
        throw new UnprocessableEntityException('RN-01: insufficient physical stock to consume the spare part');
      }
      // Keep a partial reservation available until all reserved units are used.
      await transaction.quotePart.update({
        where: { id: part.id },
        data: { status: dto.quantity === pendingQuantity ? 'INSTALLED' : 'RESERVED' },
      });
      // HU-07: first consumption of an approved order moves it to repair.
      if (nextStatus && nextStatus !== order.status) {
        await transaction.workOrder.update({ where: { id: workOrderId }, data: { status: nextStatus } });
      }
      // BE-17: immutable kardex record (audit trail, never updated/deleted).
      // The mechanic's optional note is persisted as the movement reason.
      await transaction.stockMovement.create({
        data: {
          workOrderId,
          sparePartId: part.sparePartId,
          userId,
          quantity: dto.quantity,
          type: 'OUT',
          ...(dto.notes ? { reason: dto.notes } : {}),
        },
      });
      // RN-19: permanent technical history entry.
      await transaction.technicalHistory.create({
        data: {
          vehicleId: order.vehicleId,
          description: `Spare part consumed for work order ${workOrderId}: ${part.sparePart.code} x${dto.quantity}`,
        },
      });
      // RN-16: return only the agreed allowlist. No financial fields.
      return {
        id: part.id,
        code: part.sparePart.code,
        name: part.sparePart.name,
        quantity: dto.quantity,
         status: dto.quantity === pendingQuantity ? 'INSTALLED' : 'RESERVED',
      };
    });
  }

  // HU-07 / BE-E03 / BE-16 / RN-08 / RN-19: atomically return a spare part that
  // was already consumed (installed) in a work order. The physical and available
  // stock are restored, the kardex IN movement and the immutable technical
  // history entry are recorded, and the quote part line is released when no
  // unit of it remains installed. RN-01 is enforced against the net consumed
  // units (OUT - IN) of the part for this work order, so the returned quantity
  // can never exceed what was actually discounted and stock is never restored
  // twice.
  returnPart(
    workOrderId: string,
    dto: ReturnSparePartDto,
    userId: string,
  ): Promise<WorkOrderPartResponseDto> {
    return this.prisma.$transaction(async (transaction) => {
      const order = await transaction.workOrder.findUnique({
        where: { id: workOrderId },
        select: {
          id: true,
          status: true,
          vehicleId: true,
          quote: {
            select: {
              parts: {
                where: { sparePartId: dto.sparePartId },
                select: {
                  id: true,
                  sparePartId: true,
                  quantity: true,
                  status: true,
                  sparePart: { select: { code: true, name: true } },
                },
              },
            },
          },
        },
      });
      const part = order?.quote?.parts?.[0];
      if (!order || !part) throw new NotFoundException('Work order not found');

      // RN-01: only units that were actually discounted can be returned. The
      // net consumed amount already discounts previous returns (kardex IN).
      const movements = await transaction.stockMovement.groupBy({
        by: ['type'],
        where: { workOrderId, sparePartId: part.sparePartId },
        _sum: { quantity: true },
      });
      let netConsumed = 0;
      for (const movement of movements) {
        if (movement.type === 'OUT') netConsumed += movement._sum.quantity ?? 0;
        if (movement.type === 'IN') netConsumed -= movement._sum.quantity ?? 0;
      }
      if (netConsumed <= 0) {
        throw new UnprocessableEntityException(
          'RN-01: the spare part has not been consumed in this work order',
        );
      }
      if (dto.quantity > netConsumed) {
        throw new UnprocessableEntityException(
          'RN-01: quantity exceeds the net consumed units of the spare part for this work order',
        );
      }

      const sparePart = await transaction.sparePart.findUnique({
        where: { id: part.sparePartId },
        select: { physicalStock: true, isActive: true },
      });
      if (!sparePart || !sparePart.isActive) {
        throw new NotFoundException('Spare part not found or inactive');
      }

      // RN-08: restore the discounted physical stock. The reserved stock is
      // left untouched (the reserved units were already consumed) and the
      // available stock is increased to keep recentered on physical stock, so
      // the balance available = physical - reserved is never corrupted.
      const newPhysicalStock = sparePart.physicalStock + dto.quantity;
      await transaction.sparePart.update({
        where: { id: part.sparePartId },
        data: {
          physicalStock: { increment: dto.quantity },
          availableStock: { increment: dto.quantity },
          lastMovementAt: new Date(),
        },
      });

      // BE-17: immutable kardex record (audit trail, never updated/deleted);
      // the mechanic's optional note is persisted as the movement reason.
      await transaction.stockMovement.create({
        data: {
          workOrderId,
          sparePartId: part.sparePartId,
          userId,
          quantity: dto.quantity,
          type: 'IN',
          reason: dto.notes ?? `Spare part returned to stock for work order ${workOrderId}`,
          previousPhysicalStock: sparePart.physicalStock,
          newPhysicalStock,
        },
      });

      // The quote part line keeps being billed while it still has installed
      // units; when nothing remains installed it is fully released.
      const remainingInstalled = netConsumed - dto.quantity;
      const nextStatus = remainingInstalled <= 0 ? 'RELEASED' : 'INSTALLED';
      await transaction.quotePart.update({
        where: { id: part.id },
        data: { status: nextStatus },
      });

      // RN-19: permanent technical history entry.
      await transaction.technicalHistory.create({
        data: {
          vehicleId: order.vehicleId,
          description: `Spare part returned to stock for work order ${workOrderId}: ${part.sparePart.code} x${dto.quantity} by user ${userId}`,
        },
      });

      // RN-16: return only the agreed allowlist. No financial fields.
      return {
        id: part.id,
        code: part.sparePart.code,
        name: part.sparePart.name,
        quantity: dto.quantity,
        status: nextStatus,
      };
    });
  }

  // US-13: read context needed to validate an awaiting-part transition.
  // Returns ownership, status and the quote parts linked to this work order
  // so the service can verify the missingPartId belongs to the order.
  findAwaitingPartContext(workOrderId: string) {
    return this.prisma.workOrder.findUnique({
      where: { id: workOrderId },
      select: {
        id: true,
        status: true,
        mechanicId: true,
        vehicleId: true,
        quote: {
          select: {
            parts: {
              select: {
                id: true,
                sparePartId: true,
                quantity: true,
                status: true,
              },
            },
          },
        },
      },
    });
  }

  // US-13 / BE-16 / RN-05 / RN-19: atomically set a work order to
  // EN_ESPERA_DE_REPUESTO. The state transition, the immutable technical
  // history entry and the inventory discrepancy record all run inside a
  // single Prisma transaction (BE-16).
  setAwaitingPart(
    workOrderId: string,
    dto: SetAwaitingPartDto,
    userId: string,
    vehicleId: string,
  ): Promise<AwaitingPartResponseDto> {
    return this.prisma.$transaction(async (transaction) => {
      // BE-17: update work order status to EN_ESPERA_DE_REPUESTO (RN-05).
      await transaction.workOrder.update({
        where: { id: workOrderId },
        data: { status: 'EN_ESPERA_DE_REPUESTO' },
      });

      // RN-19: permanent, immutable technical history entry.
      await transaction.technicalHistory.create({
        data: {
          vehicleId,
          description:
            `Work order set to AWAITING_PART. Missing spare part id: ${dto.missingPartId}, quantity: ${dto.quantity}. Reason: ${dto.reason}`,
        },
      });

      // US-13: register an inventory discrepancy for the workshop lead to
      // audit the physical stock mismatch later.
      const discrepancy = await transaction.inventoryDiscrepancy.create({
        data: {
          workOrderId,
          sparePartId: dto.missingPartId,
          reportedBy: userId,
          quantity: dto.quantity,
          reason: dto.reason,
        },
      });

      return {
        id: workOrderId,
        status: 'EN_ESPERA_DE_REPUESTO',
        missingPartId: dto.missingPartId,
        quantity: dto.quantity,
        reason: dto.reason,
        createdAt: discrepancy.createdAt,
      };
    });
  }

  // US-19: read the context needed to conclude a repair: status, assigned
  // mechanic, vehicle and receptionist. No financial fields (RN-16).
  findCompleteContext(workOrderId: string) {
    return this.prisma.workOrder.findUnique({
      where: { id: workOrderId },
      select: {
        id: true,
        status: true,
        mechanicId: true,
        vehicleId: true,
        receptionistId: true,
      },
    });
  }

  // US-19 / BE-16 / RN-05 / RN-14 / RN-19: atomically conclude a repair. Sets
  // the work order to LISTO_ENTREGA, frees its physical bay, persists the
  // immutable technical history entry and notifies reception (single
  // Prisma transaction, BE-16).
  completeWorkOrder(
    workOrderId: string,
    dto: CompleteWorkOrderDto,
    userId: string,
  ): Promise<CompleteWorkOrderResponseDto> {
    return this.prisma.$transaction(async (transaction) => {
      const order = await transaction.workOrder.findUnique({
        where: { id: workOrderId },
        select: { id: true, vehicleId: true, receptionistId: true },
      });
      if (!order) throw new NotFoundException('Work order not found');

      // RN-05 / RN-14: release the physical bay bound to this work order.
      const bay = await transaction.workBay.findFirst({
        where: { currentWorkOrderId: workOrderId },
        select: { id: true, bayNumber: true },
      });
      if (bay) {
        await transaction.workBay.update({
          where: { id: bay.id },
          data: { isOccupied: false, currentWorkOrderId: null },
        });
      }

      const completedAt = new Date();
      await transaction.workOrder.update({
        where: { id: workOrderId },
        data: { status: 'LISTO_ENTREGA' },
      });

      // RN-19: permanent, immutable technical history entry with the user who
      // concluded the work and the closing data entered by the mechanic.
      const mileageNote = dto.finalMileage !== undefined ? `, final mileage: ${dto.finalMileage} km` : '';
      const notes = dto.closingNotes ? `, closing notes: ${dto.closingNotes}` : '';
      await transaction.technicalHistory.create({
        data: {
          vehicleId: order.vehicleId,
          description:
            `Work order ${workOrderId} concluded and ready for pickup. Completed by user ${userId}.` +
            `${mileageNote}${notes}`,
        },
      });

      // US-19 gherkin: reception gets an indicator that the vehicle is ready.
      await transaction.notification.create({
        data: {
          recipientId: order.receptionistId,
          workOrderId,
          type: 'WORK_ORDER_READY',
          message: `The vehicle from work order ${workOrderId} is ready for pickup`,
        },
      });

      return {
        id: workOrderId,
        status: 'LISTO_ENTREGA',
        completedAt,
        bayNumber: bay?.bayNumber ?? null,
        finalMileage: dto.finalMileage ?? null,
        closingNotes: dto.closingNotes ?? null,
      };
    });
  }

  // US-20: read the context needed to build the consolidated settlement
  // (RN-21). Financial fields are exposed only to RECEPTIONIST/ADMIN roles
  // through the settlement DTO (BE-12, RN-21). Includes vehicle, customer,
  // the approved quote totals and the spare part lines.
  findSettlementContext(workOrderId: string) {
    return this.prisma.workOrder.findUnique({
      where: { id: workOrderId },
      select: {
        id: true,
        status: true,
        deliveredAt: true,
        vehicleId: true,
        vehicle: { select: { plate: true, brand: true, model: true, year: true } },
        customer: { select: { name: true } },
        quote: {
          select: {
            laborSubtotal: true,
            partsSubtotal: true,
            currency: true,
            parts: {
              select: {
                id: true,
                status: true,
                quantity: true,
                unitPrice: true,
                subtotal: true,
                sparePart: { select: { code: true, name: true } },
              },
            },
          },
        },
        settlementAdjustments: {
          select: {
            id: true,
            type: true,
            amount: true,
            reason: true,
            appliedBy: true,
            createdAt: true,
          },
        },
      },
    });
  }

  // US-20 / BE-16 / RN-21 / RN-19: atomically settle and deliver a vehicle.
  // The status transition to ENTREGADO, the handover timestamp, the payment
  // data, the charged total and the immutable technical history entry all run
  // inside a single Prisma transaction (BE-16).
  deliverWorkOrder(
    workOrderId: string,
    userId: string,
    dto: DeliverWorkOrderDto,
  ): Promise<DeliverWorkOrderResponseDto> {
    return this.prisma.$transaction(async (transaction) => {
      const order = await transaction.workOrder.findUnique({
        where: { id: workOrderId },
        select: {
          id: true,
          vehicleId: true,
          status: true,
          deliveredAt: true,
          quote: {
            select: {
              laborSubtotal: true,
              currency: true,
              parts: {
                where: { status: 'INSTALLED' },
                select: { subtotal: true },
              },
            },
          },
          settlementAdjustments: {
            select: { type: true, amount: true },
          },
        },
      });
      if (!order) throw new NotFoundException('Work order not found');
      // Defensive guard inside the transaction (BE-16): prevents a concurrent
      // double settlement of the same work order (RN-21).
      if (order.status !== 'LISTO_ENTREGA') {
        throw new ConflictException('Work order must be in LISTO_ENTREGA to be delivered');
      }
      if (order.deliveredAt) {
        throw new ConflictException('Work order has already been delivered');
      }

      // HU-07 / BE-E03: parts that were never consumed (still RESERVED) are
      // released back to the available stock on the same transaction, so the
      // inventory is not permanently blocked once the vehicle is delivered.
      await releaseReservedParts(transaction, workOrderId);

      // RN-21: total = approved labor subtotal + installed parts subtotal.
      const laborSubtotal = order.quote?.laborSubtotal ?? new Prisma.Decimal(0);
      const partsSubtotal = (order.quote?.parts ?? []).reduce(
        (sum, part) => sum.plus(part.subtotal),
        new Prisma.Decimal(0),
      );
      // RN-15: subtract active discounts from the total
      const adjustments = order.settlementAdjustments;
      const activeDiscounts = adjustments.reduce(
        (sum, adj) => {
          if (adj.type === 'DISCOUNT') return sum.plus(adj.amount);
          if (adj.type === 'VOID') return sum.minus(adj.amount);
          return sum;
        },
        new Prisma.Decimal(0),
      );
      const totalCharged = laborSubtotal.plus(partsSubtotal).minus(activeDiscounts);

      const deliveredAt = new Date();
      await transaction.workOrder.update({
        where: { id: workOrderId },
        data: {
          status: 'ENTREGADO',
          deliveredAt,
          paymentMethod: dto.paymentMethod,
          receiptNumber: dto.receiptNumber,
          totalCharged,
          ...(dto.deliveryNotes ? { deliveryNotes: dto.deliveryNotes } : {}),
        },
      });

      // RN-19: permanent, immutable technical history entry documenting the
      // settlement and the handover.
      const historyParts = [
        `Work order ${workOrderId} delivered. Payment: ${dto.paymentMethod}, receipt: ${dto.receiptNumber}.`,
        `Subtotal: ${order.quote?.currency ?? 'BOB'} ${laborSubtotal.plus(partsSubtotal).toFixed(2)}.`,
      ];
      if (activeDiscounts.greaterThan(0)) {
        historyParts.push(`Discounts: -${order.quote?.currency ?? 'BOB'} ${activeDiscounts.toFixed(2)}.`);
      }
      historyParts.push(`Charged: ${order.quote?.currency ?? 'BOB'} ${totalCharged.toFixed(2)}. Delivered by user ${userId}`);

      await transaction.technicalHistory.create({
        data: {
          vehicleId: order.vehicleId,
          description: historyParts.join(' '),
        },
      });

      // RN-21 / BE-13: return the agreed allowlist. The charged total is
      // serialized as a string with the DECIMAL(12,2) scale to avoid float
      // precision loss and inconsistent trailing zeros.
      return {
        id: workOrderId,
        status: 'ENTREGADO',
        deliveredAt,
        paymentMethod: dto.paymentMethod,
        receiptNumber: dto.receiptNumber,
        totalCharged: totalCharged.toFixed(2),
        deliveryNotes: dto.deliveryNotes ?? null,
      };
    });
  }

  // US-20 / RN-15 / BE-16 / BE-17: apply a discount to the settlement of a
  // work order. The discount is recorded as an immutable SettlementAdjustment
  // (insert-only, same pattern as StockMovement). A technicalHistory entry is
  // created for permanent audit trail (RN-19).
  applyDiscount(
    workOrderId: string,
    userId: string,
    dto: ApplyDiscountDto,
  ): Promise<SettlementAdjustmentResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.workOrder.findUnique({
        where: { id: workOrderId },
        select: {
          id: true,
          vehicleId: true,
          status: true,
          deliveredAt: true,
          quote: {
            select: {
              laborSubtotal: true,
              currency: true,
              parts: {
                where: { status: 'INSTALLED' },
                select: { subtotal: true },
              },
            },
          },
          settlementAdjustments: {
            select: { type: true, amount: true },
          },
        },
      });
      if (!order) throw new NotFoundException('Work order not found');
      if (order.status !== 'LISTO_ENTREGA') {
        throw new ConflictException('Work order must be in LISTO_ENTREGA to apply discounts');
      }
      if (order.deliveredAt) {
        throw new ConflictException('Work order has already been delivered');
      }

      // Calculate active discounts: sum(DISCOUNT) - sum(VOID)
      const activeDiscounts = order.settlementAdjustments.reduce(
        (sum, adj) => {
          if (adj.type === 'DISCOUNT') return sum.plus(adj.amount);
          if (adj.type === 'VOID') return sum.minus(adj.amount);
          return sum;
        },
        new Prisma.Decimal(0),
      );

      // Calculate the gross total: labor + INSTALLED parts
      const laborSubtotal = order.quote?.laborSubtotal ?? new Prisma.Decimal(0);
      const partsSubtotal = (order.quote?.parts ?? []).reduce(
        (sum, part) => sum.plus(part.subtotal),
        new Prisma.Decimal(0),
      );
      const totalBruto = laborSubtotal.plus(partsSubtotal);

      // RN-15: discount cannot exceed the available amount
      const disponible = totalBruto.minus(activeDiscounts);
      if (new Prisma.Decimal(dto.amount).greaterThan(disponible)) {
        throw new UnprocessableEntityException(
          'RN-15: discount amount exceeds the available total for this settlement',
        );
      }

      // Create the immutable DISCOUNT adjustment (insert-only, BE-17)
      const adjustment = await tx.settlementAdjustment.create({
        data: {
          workOrderId,
          type: 'DISCOUNT',
          amount: new Prisma.Decimal(dto.amount),
          reason: dto.reason,
          appliedBy: userId,
        },
      });

      // RN-19: immutable technical history entry
      await tx.technicalHistory.create({
        data: {
          vehicleId: order.vehicleId,
          description:
            `Work order ${workOrderId} settlement discount applied: ${order.quote?.currency ?? 'BOB'} ` +
            `${dto.amount.toFixed(2)}. Reason: ${dto.reason}. Applied by user ${userId}`,
        },
      });

      return {
        id: adjustment.id,
        workOrderId,
        type: AdjustmentType.DISCOUNT,
        amount: adjustment.amount.toFixed(2),
        reason: adjustment.reason,
        appliedBy: adjustment.appliedBy,
        createdAt: adjustment.createdAt,
      };
    });
  }

  // US-20 / RN-15 / BE-16 / BE-17: void (reverse) a previously applied
  // discount. Creates a new VOID record that mirrors the original amount.
  // The original DISCOUNT record is never modified or deleted (BE-17).
  voidAdjustment(
    workOrderId: string,
    userId: string,
    dto: VoidAdjustmentDto,
  ): Promise<SettlementAdjustmentResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.workOrder.findUnique({
        where: { id: workOrderId },
        select: {
          id: true,
          vehicleId: true,
          status: true,
          deliveredAt: true,
          quote: { select: { currency: true } },
        },
      });
      if (!order) throw new NotFoundException('Work order not found');
      if (order.status !== 'LISTO_ENTREGA') {
        throw new ConflictException('Work order must be in LISTO_ENTREGA to void adjustments');
      }
      if (order.deliveredAt) {
        throw new ConflictException('Work order has already been delivered');
      }

      // Find the original adjustment
      const original = await tx.settlementAdjustment.findUnique({
        where: { id: dto.adjustmentId },
      });
      if (!original || original.workOrderId !== workOrderId) {
        throw new NotFoundException('Adjustment not found or does not belong to this work order');
      }
      if (original.type !== 'DISCOUNT') {
        throw new ConflictException('Only DISCOUNT adjustments can be voided');
      }

      // Check that this DISCOUNT has not already been voided
      const existingVoid = await tx.settlementAdjustment.findFirst({
        where: {
          workOrderId,
          type: 'VOID',
          reason: { contains: original.id },
        },
      });
      if (existingVoid) {
        throw new ConflictException('This discount has already been voided');
      }

      // Create the VOID record (insert-only, BE-17)
      const voidRecord = await tx.settlementAdjustment.create({
        data: {
          workOrderId,
          type: 'VOID',
          amount: original.amount,
          reason: `VOID of adjustment ${original.id}: ${dto.reason}`,
          appliedBy: userId,
        },
      });

      // RN-19: immutable technical history entry
      await tx.technicalHistory.create({
        data: {
          vehicleId: order.vehicleId,
          description:
            `Work order ${workOrderId} settlement adjustment voided: original ${original.id} ` +
            `(${order.quote?.currency ?? 'BOB'} ${original.amount.toFixed(2)}). ` +
            `Reason: ${dto.reason}. Voided by user ${userId}`,
        },
      });

      return {
        id: voidRecord.id,
        workOrderId,
        type: AdjustmentType.VOID,
        amount: voidRecord.amount.toFixed(2),
        reason: voidRecord.reason,
        appliedBy: voidRecord.appliedBy,
        createdAt: voidRecord.createdAt,
      };
    });
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma } from '../../../generated/prisma/client';
import { RegisterVehicleEntryDto, WorkOrderResponseDto } from '../dto/register-vehicle-entry.dto';
import { WorkOrderStatus } from '../../../common/enums/work-order-status.enum';

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

export interface ActiveMechanicRow {
  id: string;
  isActive: boolean;
  name: string | null;
}

@Injectable()
export class VehicleReceptionRepository {
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

  // HU-12: list work orders awaiting a quote (IN_DIAGNOSIS). No monetary
  // fields are exposed to the advisor list (RN-16).
  findPendingQuoteOrders() {
    return this.prisma.workOrder.findMany({
      where: { status: WorkOrderStatus.IN_DIAGNOSIS },
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
      where: { status: WorkOrderStatus.RECEIVED, mechanicId: null },
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
    return this.prisma.workOrder.count({ where: { status: WorkOrderStatus.RECEIVED, mechanicId: null } });
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

  // US-05 / BE-T05.1: tracking summary filtered by license plate, status or
  // physical bay. Mechanic names are resolved from the users table because
  // Mechanic.id doubles as User.id (seed convention), mirroring the bay
  // monitoring query (US-18).
  //
  // US-16 / RN-06 (BE-T16.3): when the service passes a staleQuoteCutoff, the
  // query filters at the database to QUOTE_SENT orders whose quote was
  // emitted before that date (15+ days waiting approval).
  //
  // BE-E13 / BE-24: page and pageSize paginate the row set; the same filters
  // drive countTrackingSummary so total reflects the full filtered population.
  async findTrackingSummary(filters: {
    licensePlate?: string;
    status?: string;
    workBayId?: string;
    staleQuoteCutoff?: Date;
    page?: number;
    pageSize?: number;
  }): Promise<WorkOrderTrackingRow[]> {
    const where = this.buildTrackingWhere(filters);
    const orders = await this.prisma.workOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: ((filters.page ?? 1) - 1) * (filters.pageSize ?? 20),
      take: filters.pageSize ?? 20,
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

  // BE-E13 / BE-24: total matching rows for the tracking filters, so the
  // frontend can page the summary (US-05 / US-16 share the same where).
  async countTrackingSummary(filters: {
    licensePlate?: string;
    status?: string;
    workBayId?: string;
    staleQuoteCutoff?: Date;
  }): Promise<number> {
    return this.prisma.workOrder.count({ where: this.buildTrackingWhere(filters) });
  }

  private buildTrackingWhere(filters: {
    licensePlate?: string;
    status?: string;
    workBayId?: string;
    staleQuoteCutoff?: Date;
  }): Prisma.WorkOrderWhereInput {
    return {
      ...(filters.licensePlate ? { vehicle: { is: { plate: filters.licensePlate } } } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.workBayId ? { currentBay: { is: { id: filters.workBayId } } } : {}),
      ...(filters.staleQuoteCutoff
        ? {
            status: WorkOrderStatus.QUOTE_SENT,
            quote: { is: { createdAt: { lte: filters.staleQuoteCutoff } } },
          }
        : {}),
    };
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
}
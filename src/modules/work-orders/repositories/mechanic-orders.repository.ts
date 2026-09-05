import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

// HU-13: the approved quote is injected alongside the assigned order so the
// frontend can read the spare part (missingPartId) required by the awaiting
// part modal. Only non-financial fields are selected (RN-16 / BE-12).
export interface AssignedQuotePartRow {
  id: string;
  sparePartId: string;
  quantity: number;
  status: string;
  sparePart: { id: string; code: string; name: string };
}

export interface AssignedQuoteRow {
  id: string;
  approvals: Array<{ decision: string }>;
  parts: AssignedQuotePartRow[];
}

// HU-07: detail row of an assigned work order. quote exposes the spare parts
// of the approved quote (with sparePartId, HU-13) without financial fields.
export interface AssignedWorkOrderDetailRow {
  id: string;
  vehicleId: string;
  status: string;
  initialComplaint: string;
  assignedAt: Date | null;
  vehicle: { plate: string; brand: string; model: string; year: number };
  quote: AssignedQuoteRow | null;
}

export interface AssignedWorkOrderRow {
  id: string;
  vehicleId: string;
  status: string;
  initialComplaint: string;
  assignedAt: Date | null;
  vehicle: { plate: string; brand?: string; model?: string; year?: number };
  quote: AssignedQuoteRow | null;
}

// BE-08: PrismaService is only injected inside repositories. BE-09: semantic
// data-access methods. Only assigned fields are selected and no cost or price
// is ever read here (RN-16 / BE-12).
@Injectable()
export class MechanicOrdersRepository {
  constructor(private readonly prisma: PrismaService) {}

  // The Quote model has no status column: an order's quote is approved when its
  // latest QuoteApproval has decision 'APPROVED' (work order APROBADO).
  findAssignedToMechanic(mechanicId: string, page: number, pageSize: number): Promise<AssignedWorkOrderRow[]> {
    return this.prisma.workOrder.findMany({
      where: { mechanicId },
      orderBy: { assignedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        vehicleId: true,
        status: true,
        initialComplaint: true,
        assignedAt: true,
        vehicle: { select: { plate: true } },
        quote: {
          select: {
            id: true,
            approvals: {
              select: { decision: true },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
            parts: {
              select: {
                id: true,
                sparePartId: true,
                quantity: true,
                status: true,
                sparePart: { select: { id: true, code: true, name: true } },
              },
            },
          },
        },
      },
    });
  }

  // HU-07: returns the assigned work order detail together with the reserved
  // spare part lines of its approved quote (RN-07). Only non-financial fields
  // are selected so no price is ever exposed to a mechanic (RN-16 / BE-12).
  findAssignedDetail(mechanicId: string, workOrderId: string): Promise<AssignedWorkOrderDetailRow | null> {
    return this.prisma.workOrder.findFirst({
      where: { id: workOrderId, mechanicId },
      select: {
        id: true,
        vehicleId: true,
        status: true,
        initialComplaint: true,
        assignedAt: true,
        vehicle: { select: { plate: true, brand: true, model: true, year: true } },
        quote: {
          select: {
            id: true,
            approvals: {
              select: { decision: true },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
            parts: {
              select: {
                id: true,
                sparePartId: true,
                quantity: true,
                status: true,
                sparePart: { select: { id: true, code: true, name: true } },
              },
            },
          },
        },
      },
    });
  }

  countAssignedToMechanic(mechanicId: string) {
    return this.prisma.workOrder.count({ where: { mechanicId } });
  }
}

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
// FE-T21.3 (US-21): additionalFindingStatus carries the decision state of the
// latest additional finding (PENDING_QUOTE/APPROVED/REJECTED) or null when the
// order has no annex. Only the status string is queried, never costs (RN-16).
export interface AssignedWorkOrderDetailRow {
  id: string;
  vehicleId: string;
  status: string;
  initialComplaint: string;
  assignedAt: Date | null;
  vehicle: { plate: string; brand: string; model: string; year: number };
  quote: AssignedQuoteRow | null;
  additionalFindingStatus: 'PENDING_QUOTE' | 'APPROVED' | 'REJECTED' | null;
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
  // latest QuoteApproval has decision 'APPROVED' (work order APPROVED).
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
  async findAssignedDetail(mechanicId: string, workOrderId: string): Promise<AssignedWorkOrderDetailRow | null> {
    const order = await this.prisma.workOrder.findFirst({
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
        // US-21 / FE-T21.3: the latest additional finding so the mechanic leaf
        // can reflect the reception decision. Only status, no monetary fields
        // (RN-16). The relation already exists on the generated schema.
        additionalFindings: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { status: true },
        },
      },
    });
    if (!order) return null;

    // Flatten the latests additional finding status into the row contract.
    const { additionalFindings, ...rest } = order;
    return {
      ...rest,
      additionalFindingStatus: (additionalFindings[0]?.status ??
        null) as AssignedWorkOrderDetailRow['additionalFindingStatus'],
    };
  }

  countAssignedToMechanic(mechanicId: string) {
    return this.prisma.workOrder.count({ where: { mechanicId } });
  }
}

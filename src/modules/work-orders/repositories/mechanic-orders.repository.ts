import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

// HU-07 / BE-12: a reserved spare part line exposed to a mechanic. Financial
// fields (unitPrice, subtotal) are deliberately excluded (RN-16).
export interface AssignedReservedPartRow {
  id: string;
  quantity: number;
  status: string;
  sparePart: { code: string; name: string };
}

export interface AssignedWorkOrderDetailRow {
  id: string;
  vehicleId: string;
  status: string;
  initialComplaint: string;
  assignedAt: Date | null;
  vehicle: { plate: string; brand: string; model: string; year: number };
  quote: { parts: AssignedReservedPartRow[] } | null;
}

export interface AssignedWorkOrderRow {
  id: string;
  vehicleId: string;
  status: string;
  initialComplaint: string;
  assignedAt: Date | null;
  vehicle: { plate: string };
}

// BE-08: PrismaService is only injected inside repositories. BE-09: semantic
// data-access methods. Only assigned fields are selected and no cost or price
// is ever read here (RN-16 / BE-12).
@Injectable()
export class MechanicOrdersRepository {
  constructor(private readonly prisma: PrismaService) {}

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
            parts: {
              select: {
                id: true,
                quantity: true,
                status: true,
                sparePart: { select: { code: true, name: true } },
              },
            },
          },
        },
      },
    }) as Promise<AssignedWorkOrderDetailRow | null>;
  }

  countAssignedToMechanic(mechanicId: string) {
    return this.prisma.workOrder.count({ where: { mechanicId } });
  }
}

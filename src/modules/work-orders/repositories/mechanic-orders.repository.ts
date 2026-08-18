import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

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

  findAssignedDetail(mechanicId: string, workOrderId: string): Promise<AssignedWorkOrderRow | null> {
    return this.prisma.workOrder.findFirst({
      where: { id: workOrderId, mechanicId },
      select: {
        id: true,
        vehicleId: true,
        status: true,
        initialComplaint: true,
        assignedAt: true,
        vehicle: { select: { plate: true, brand: true, model: true, year: true } },
      },
    }) as Promise<AssignedWorkOrderRow | null>;
  }

  countAssignedToMechanic(mechanicId: string) {
    return this.prisma.workOrder.count({ where: { mechanicId } });
  }
}

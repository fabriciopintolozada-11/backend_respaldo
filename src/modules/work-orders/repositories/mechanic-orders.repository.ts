import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

// BE-08: PrismaService is only injected inside repositories. BE-09: semantic
// data-access methods. Only assigned fields are selected and no cost or price
// is ever read here (RN-16 / BE-12).
@Injectable()
export class MechanicOrdersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAssignedToMechanic(mechanicId: string, page: number, pageSize: number) {
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

  countAssignedToMechanic(mechanicId: string) {
    return this.prisma.workOrder.count({ where: { mechanicId } });
  }
}

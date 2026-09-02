import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

// BE-08: PrismaService is only injected inside repositories. This class exposes
// semantic data-access methods for the public vehicle status lookup (RN-17).
@Injectable()
export class VehicleStatusRepository {
  constructor(private readonly prisma: PrismaService) {}

  findLatestByPlateAndIdentification(plate: string, identification: string) {
    return this.prisma.workOrder.findFirst({
      where: {
        vehicle: { plate },
        customer: { identification },
        // HU-02 / RN-17: any operational work order is visible through the public
        // query. Only rejected and delivered (closed) orders are excluded.
        status: { notIn: ['RECHAZADO', 'ENTREGADO'] },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        createdAt: true,
        vehicle: { select: { plate: true, brand: true, model: true, year: true } },
      },
    });
  }
}

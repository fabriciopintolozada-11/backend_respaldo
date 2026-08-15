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
      },
      orderBy: { createdAt: 'desc' },
      include: { vehicle: true, customer: true },
    });
  }
}

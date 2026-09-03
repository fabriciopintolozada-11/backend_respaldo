import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma } from '../../../generated/prisma/client';

// BE-08: PrismaService is only injected inside repositories.
@Injectable()
export class SparePartRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.sparePart.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: this.selectPublicFields(),
    });
  }

  findById(id: string) {
    return this.prisma.sparePart.findFirst({
      where: { id, isActive: true },
      select: this.selectPublicFields(),
    });
  }

  private selectPublicFields(): Prisma.SparePartSelect {
    return {
      id: true,
      code: true,
      name: true,
      unitPrice: true,
      availableStock: true,
      reservedStock: true,
      isActive: true,
    };
  }
}

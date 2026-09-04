import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma } from '../../../generated/prisma/client';
import { CreateSparePartDto } from '../dto/create-spare-part.dto';
import { QuerySparePartsDto } from '../dto/query-spare-parts.dto';

// BE-08: PrismaService is only injected inside repositories.
@Injectable()
export class SparePartRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: QuerySparePartsDto) {
    const search = query.search?.trim();
    return this.prisma.sparePart.findMany({
      where: {
        isActive: true,
        ...(query.category ? { category: query.category } : {}),
        ...(search ? { OR: [{ code: { contains: search, mode: 'insensitive' } }, { name: { contains: search, mode: 'insensitive' } }] } : {}),
      },
      orderBy: { name: 'asc' },
      skip: ((query.page ?? 1) - 1) * (query.pageSize ?? 20),
      take: query.pageSize ?? 20,
      select: this.selectPublicFields(),
    });
  }

  count(query: QuerySparePartsDto) {
    const search = query.search?.trim();
    return this.prisma.sparePart.count({
      where: {
        isActive: true,
        ...(query.category ? { category: query.category } : {}),
        ...(search ? { OR: [{ code: { contains: search, mode: 'insensitive' } }, { name: { contains: search, mode: 'insensitive' } }] } : {}),
      },
    });
  }

  findById(id: string) {
    return this.prisma.sparePart.findFirst({
      where: { id, isActive: true },
      select: this.selectPublicFields(),
    });
  }

  create(dto: CreateSparePartDto, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const part = await tx.sparePart.create({
        data: {
          code: dto.code.trim().toUpperCase(),
          name: dto.name.trim(),
          category: dto.category,
          unitPrice: new Prisma.Decimal(dto.unitPrice),
          physicalStock: dto.initialStock,
          availableStock: dto.initialStock,
          reservedStock: 0,
        },
        select: this.selectPublicFields(),
      });
      await tx.stockMovement.create({
        data: {
          sparePartId: part.id,
          userId,
          quantity: dto.initialStock,
          type: 'ADJUSTMENT',
          reason: 'Initial catalog stock',
          previousPhysicalStock: 0,
          newPhysicalStock: dto.initialStock,
        },
      });
      return part;
    });
  }

  findForDeactivation(id: string) {
    return this.prisma.sparePart.findFirst({
      where: { id, isActive: true },
      select: { id: true, reservedStock: true, quoteItems: { where: { status: 'RESERVED' }, select: { id: true } } },
    });
  }

  deactivate(id: string) {
    return this.prisma.sparePart.update({ where: { id }, data: { isActive: false }, select: this.selectPublicFields() });
  }

  private selectPublicFields(): Prisma.SparePartSelect {
    return {
      id: true,
      code: true,
      name: true,
      category: true,
      unitPrice: true,
      physicalStock: true,
      availableStock: true,
      reservedStock: true,
      isActive: true,
      lastMovementAt: true,
    };
  }
}

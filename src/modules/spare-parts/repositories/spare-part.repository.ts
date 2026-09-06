import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma } from '../../../generated/prisma/client';
import { CreateSparePartDto } from '../dto/create-spare-part.dto';
import { CreateInventoryAdjustmentDto, InventoryAdjustmentType } from '../dto/create-inventory-adjustment.dto';
import { InventoryAdjustmentResponseDto } from '../dto/inventory-adjustment-response.dto';
import { QuerySparePartsDto } from '../dto/query-spare-parts.dto';
import { InventoryAlertType } from '../dto/inventory-alert-type.enum';
import { QueryInventoryAlertsDto } from '../dto/query-inventory-alerts.dto';

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

  async findInventoryAlerts(
    query: QueryInventoryAlertsDto,
    rotationCutoff: Date,
  ): Promise<{ data: InventoryAlertCandidate[]; total: number }> {
    const filters = [Prisma.sql`sp.is_active = true`];
    const search = query.search?.trim();

    if (search) {
      filters.push(Prisma.sql`(sp.code ILIKE ${`%${search}%`} OR sp.name ILIKE ${`%${search}%`})`);
    }

    if (query.alertType === InventoryAlertType.NO_ROTATION) {
      filters.push(Prisma.sql`sp.physical_stock > 0 AND sp.last_movement_at <= ${rotationCutoff}`);
    } else if (query.alertType === InventoryAlertType.STOCK_OUT) {
      filters.push(Prisma.sql`sp.physical_stock - sp.reserved_stock <= 0`);
    } else {
      filters.push(
        Prisma.sql`(sp.physical_stock > 0 AND sp.last_movement_at <= ${rotationCutoff} OR sp.physical_stock - sp.reserved_stock <= 0)`,
      );
    }

    if (query.category) {
      filters.push(Prisma.sql`sp.category = ${query.category}`);
    }

    const where = Prisma.join(filters, ' AND ');
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;
    const [data, countRows] = await Promise.all([
      this.prisma.$queryRaw<InventoryAlertCandidate[]>(Prisma.sql`
        SELECT
          sp.id,
          sp.code,
          sp.name,
          sp.category,
          sp.physical_stock AS "physicalStock",
          sp.reserved_stock AS "reservedStock",
          sp.last_movement_at AS "lastMovementAt"
        FROM spare_parts sp
        WHERE ${where}
        ORDER BY sp.name ASC, sp.code ASC
        LIMIT ${pageSize} OFFSET ${offset}
      `),
      this.prisma.$queryRaw<[{ total: bigint }]>(Prisma.sql`
        SELECT COUNT(*)::bigint AS total
        FROM spare_parts sp
        WHERE ${where}
      `),
    ]);

    return { data, total: Number(countRows[0]?.total ?? 0) };
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

  // US-14 / BE-16 / BE-17 / RN-07: atomically adjust physical stock and record
  // the movement in the immutable kardex. A NEGATIVE adjustment that would
  // leave physicalStock below reservedStock is rejected at the database level.
  createAdjustment(
    sparePartId: string,
    dto: CreateInventoryAdjustmentDto,
    userId: string,
  ): Promise<InventoryAdjustmentResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const part = await tx.sparePart.findUnique({ where: { id: sparePartId } });
      if (!part) throw new UnprocessableEntityException('Spare part not found or inactive');

      const delta = dto.type === InventoryAdjustmentType.POSITIVE ? dto.quantity : -dto.quantity;
      const newPhysicalStock = part.physicalStock + delta;

      // RN-07: physical stock must never drop below reserved stock.
      if (newPhysicalStock < 0 || newPhysicalStock < part.reservedStock) {
        throw new UnprocessableEntityException(
          `RN-07: adjustment would result in physicalStock (${newPhysicalStock}) below reservedStock (${part.reservedStock})`,
        );
      }

      const updated = await tx.sparePart.update({
        where: { id: sparePartId },
        data: {
          physicalStock: newPhysicalStock,
          lastMovementAt: new Date(),
        },
        select: this.selectPublicFields(),
      });

      // BE-17: immutable kardex record. Insert-only, never updated or deleted.
      await tx.stockMovement.create({
        data: {
          sparePartId,
          userId,
          quantity: dto.quantity,
          type: 'ADJUSTMENT',
          reason: dto.reason,
          previousPhysicalStock: part.physicalStock,
          newPhysicalStock,
        },
      });

      // US-13 integration: if the adjustment resolves a reported discrepancy,
      // mark it as resolved within the same transaction.
      if (dto.inventoryDiscrepancyId) {
        const discrepancy = await tx.inventoryDiscrepancy.findUnique({
          where: { id: dto.inventoryDiscrepancyId },
        });
        if (!discrepancy || discrepancy.sparePartId !== sparePartId || discrepancy.status !== 'PENDING') {
          throw new UnprocessableEntityException(
            'inventoryDiscrepancyId does not exist, does not belong to this spare part, or is already resolved',
          );
        }
        await tx.inventoryDiscrepancy.update({
          where: { id: dto.inventoryDiscrepancyId },
          data: { status: 'RESOLVED', resolvedBy: userId, resolvedAt: new Date() },
        });
      }

      return {
        id: updated.id,
        code: updated.code,
        name: updated.name,
        category: updated.category as InventoryAdjustmentResponseDto['category'],
        physicalStock: updated.physicalStock,
        availableStock: updated.physicalStock - updated.reservedStock,
        reservedStock: updated.reservedStock,
        unitPrice: updated.unitPrice.toString(),
        lastMovementAt: updated.lastMovementAt,
        isActive: updated.isActive,
      };
    });
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

export type InventoryAlertCandidate = {
  id: string;
  code: string;
  name: string;
  category: string;
  physicalStock: number;
  reservedStock: number;
  lastMovementAt: Date | null;
};

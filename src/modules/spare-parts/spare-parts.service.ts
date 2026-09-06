import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { SparePartRepository } from './repositories/spare-part.repository';
import { SparePartResponseDto } from './dto/spare-part.response.dto';
import { Prisma } from '../../generated/prisma/client';
import { UserRole } from '../../common/enums/user-role.enum';
import { CreateSparePartDto } from './dto/create-spare-part.dto';
import { CreateInventoryAdjustmentDto } from './dto/create-inventory-adjustment.dto';
import { InventoryAdjustmentResponseDto } from './dto/inventory-adjustment-response.dto';
import { QuerySparePartsDto } from './dto/query-spare-parts.dto';
import { ListSparePartsResponseDto } from './dto/list-spare-parts.response.dto';
import { QueryInventoryAlertsDto } from './dto/query-inventory-alerts.dto';
import { InventoryAlertResponseDto } from './dto/inventory-alert.response.dto';
import { InventoryAlertType } from './dto/inventory-alert-type.enum';
import { ListInventoryAlertsResponseDto } from './dto/list-inventory-alerts.response.dto';

// BE-12.3 (HU-12): catalog lookups used to build quotes with official prices
// enforced by the backend (BE-12.5).
@Injectable()
export class SparePartsService {
  constructor(private readonly repository: SparePartRepository) {}

  async findAll(query: QuerySparePartsDto, role: string): Promise<ListSparePartsResponseDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const [parts, total] = await Promise.all([
      this.repository.findAll({ ...query, page, pageSize }),
      this.repository.count(query),
    ]);
    return { data: parts.map((part) => this.toResponse(part, role)), total, page, pageSize };
  }

  async findById(id: string, role: string): Promise<SparePartResponseDto> {
    const part = await this.repository.findById(id);
    if (!part) throw new NotFoundException('Spare part not found');
    return this.toResponse(part, role);
  }

  async findAlerts(query: QueryInventoryAlertsDto): Promise<ListInventoryAlertsResponseDto> {
    const now = new Date();
    const rotationCutoff = new Date(now);
    rotationCutoff.setUTCDate(rotationCutoff.getUTCDate() - 60);
    const result = await this.repository.findInventoryAlerts(query, rotationCutoff);

    return {
      data: result.data.map((part) => this.toAlertResponse(part, now, query.alertType)),
      total: result.total,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
    };
  }

  async create(dto: CreateSparePartDto, userId: string): Promise<SparePartResponseDto> {
    return this.toResponse(await this.repository.create(dto, userId), UserRole.ADMIN);
  }

  async deactivate(id: string): Promise<SparePartResponseDto> {
    const part = await this.repository.findForDeactivation(id);
    if (!part) throw new NotFoundException('Spare part not found');
    if (part.reservedStock > 0 || part.quoteItems.length > 0) {
      throw new ConflictException('Spare part has pending reservations');
    }
    return this.toResponse(await this.repository.deactivate(id), UserRole.ADMIN);
  }

  // US-14: register a physical inventory adjustment. The service validates
  // that the spare part exists before delegating to the repository transaction.
  async createAdjustment(
    dto: CreateInventoryAdjustmentDto,
    userId: string,
  ): Promise<InventoryAdjustmentResponseDto> {
    const existing = await this.repository.findById(dto.sparePartId);
    if (!existing) throw new NotFoundException('Spare part not found');
    return this.repository.createAdjustment(dto.sparePartId, dto, userId);
  }

  private toResponse(part: {
    id: string;
    code: string;
    name: string;
    category: string;
    unitPrice: Prisma.Decimal;
    physicalStock: number;
    availableStock: number;
    reservedStock: number;
    isActive: boolean;
    lastMovementAt: Date;
  }, role: string): SparePartResponseDto {
    return {
      id: part.id,
      code: part.code,
      name: part.name,
      category: part.category as SparePartResponseDto['category'],
      physicalStock: part.physicalStock,
      availableStock: part.physicalStock - part.reservedStock,
      reservedStock: part.reservedStock,
      ...(role === UserRole.MECHANIC ? {} : { unitPrice: part.unitPrice.toString() }),
      lastMovementAt: part.lastMovementAt,
      isActive: part.isActive,
    };
  }

  private toAlertResponse(
    part: {
      id: string;
      code: string;
      name: string;
      category: string;
      physicalStock: number;
      reservedStock: number;
      lastMovementAt: Date | null;
    },
    now: Date,
    alertType?: InventoryAlertType,
  ): InventoryAlertResponseDto {
    const availableStock = part.physicalStock - part.reservedStock;
    const daysWithoutMovement = part.lastMovementAt
      ? Math.max(0, Math.floor((now.getTime() - part.lastMovementAt.getTime()) / 86_400_000))
      : 0;
    const resolvedAlertType =
      alertType ?? (availableStock <= 0 ? InventoryAlertType.STOCK_OUT : InventoryAlertType.NO_ROTATION);

    return {
      partId: part.id,
      code: part.code,
      name: part.name,
      category: part.category as InventoryAlertResponseDto['category'],
      physicalStock: part.physicalStock,
      reservedStock: part.reservedStock,
      availableStock,
      daysWithoutMovement,
      alertType: resolvedAlertType,
      lastMovementAt: part.lastMovementAt,
    };
  }
}

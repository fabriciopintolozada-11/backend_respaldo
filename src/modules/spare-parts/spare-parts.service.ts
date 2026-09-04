import { Injectable, NotFoundException } from '@nestjs/common';
import { SparePartRepository } from './repositories/spare-part.repository';
import { SparePartResponseDto } from './dto/spare-part.response.dto';
import { Prisma } from '../../generated/prisma/client';

// BE-12.3 (HU-12): catalog lookups used to build quotes with official prices
// enforced by the backend (BE-12.5).
@Injectable()
export class SparePartsService {
  constructor(private readonly repository: SparePartRepository) {}

  async findAll(): Promise<SparePartResponseDto[]> {
    const parts = await this.repository.findAll();
    return parts.map((part) => this.toResponse(part));
  }

  async findById(id: string): Promise<SparePartResponseDto> {
    const part = await this.repository.findById(id);
    if (!part) throw new NotFoundException('Spare part not found');
    return this.toResponse(part);
  }

  private toResponse(part: {
    id: string;
    code: string;
    name: string;
    unitPrice: Prisma.Decimal;
    availableStock: number;
    reservedStock: number;
    isActive: boolean;
  }): SparePartResponseDto {
    return {
      id: part.id,
      code: part.code,
      name: part.name,
      unitPrice: part.unitPrice.toString(),
      availableStock: part.availableStock,
      reservedStock: part.reservedStock,
      isActive: part.isActive,
    };
  }
}

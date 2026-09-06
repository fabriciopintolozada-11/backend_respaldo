import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, Matches } from 'class-validator';

// US-14: payload to register a physical inventory adjustment. Covers both
// autonomous corrections and resolution of discrepancies reported by US-13.
export enum InventoryAdjustmentType {
  POSITIVE = 'POSITIVE',
  NEGATIVE = 'NEGATIVE',
}

export class CreateInventoryAdjustmentDto {
  @ApiProperty({ description: 'UUID of the spare part to adjust', format: 'uuid' })
  @IsUUID('4')
  sparePartId!: string;

  @ApiProperty({ description: 'Number of units to add or remove', minimum: 1, maximum: 99999 })
  @IsInt()
  @Min(1)
  @Max(99999)
  quantity!: number;

  @ApiProperty({ enum: InventoryAdjustmentType, description: 'POSITIVE adds stock, NEGATIVE removes stock' })
  @IsEnum(InventoryAdjustmentType)
  type!: InventoryAdjustmentType;

  @ApiProperty({ description: 'Mandatory reason for the adjustment (10-500 chars)', minLength: 10, maxLength: 500 })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(500)
  @Matches(/\S/, { message: 'reason must contain non-whitespace characters' })
  reason!: string;

  @ApiPropertyOptional({ description: 'UUID of an existing InventoryDiscrepancy from US-13 to resolve', format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  inventoryDiscrepancyId?: string;
}

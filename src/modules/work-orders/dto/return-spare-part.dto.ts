import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

// HU-07 / BE-E03: payload to physically return a spare part that was already
// consumed (installed) in a work order. Restores the discounted physical stock
// and records the kardex IN movement. quantity must be >= 1 and can never
// exceed the net consumed units of the part for this work order (RN-01).
export class ReturnSparePartDto {
  @ApiProperty({ description: 'ID of the spare part to return to the warehouse' })
  @IsUUID()
  sparePartId!: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiPropertyOptional({ description: 'Optional note recorded in the kardex when returning the part' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
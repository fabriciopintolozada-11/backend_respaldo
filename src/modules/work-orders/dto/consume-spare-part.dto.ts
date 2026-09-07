import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

// HU-07: payload to confirm the installation of a reserved spare part.
// The part is identified by its quote_parts id (the approved quote line is the
// work order part itself, per the agreed hybrid model). quantity must be >= 1.
export class ConsumeSparePartDto {
  @ApiProperty({ description: 'ID of the reserved work-order part to install' })
  @IsUUID()
  workOrderPartId?: string;

  // Kept temporarily for clients compiled against the previous internal contract.
  @IsOptional()
  @IsUUID()
  quotePartId?: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiPropertyOptional({ description: 'Optional note recorded in the kardex when consuming the part' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsUUID, Min } from 'class-validator';

// HU-07: payload to confirm the installation of a reserved spare part.
// The part is identified by its quote_parts id (the approved quote line is the
// work order part itself, per the agreed hybrid model). quantity must be >= 1.
export class ConsumeSparePartDto {
  @ApiProperty({ description: 'ID of the approved quote part (RESERVED) to install' })
  @IsUUID()
  quotePartId!: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;
}

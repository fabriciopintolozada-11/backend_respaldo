import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SparePartCategory } from './spare-part-category.enum';

// US-14: response after a successful inventory adjustment. Returns the updated
// spare part snapshot. RN-16: unitPrice is omitted when the caller is MECHANIC.
export class InventoryAdjustmentResponseDto {
  @ApiProperty({ description: 'Spare part identifier' })
  id!: string;

  @ApiProperty({ description: 'Spare part code' })
  code!: string;

  @ApiProperty({ description: 'Spare part name' })
  name!: string;

  @ApiProperty({ enum: SparePartCategory })
  category!: SparePartCategory;

  @ApiProperty({ description: 'Physical stock after adjustment' })
  physicalStock!: number;

  @ApiProperty({ description: 'Available stock after adjustment' })
  availableStock!: number;

  @ApiProperty({ description: 'Reserved stock (unchanged by adjustment)' })
  reservedStock!: number;

  @ApiPropertyOptional({ description: 'Unit price in BOB (hidden for MECHANIC per RN-16)' })
  unitPrice?: string;

  @ApiPropertyOptional({ description: 'Timestamp of the last stock movement' })
  lastMovementAt?: Date;

  @ApiProperty({ description: 'Whether the spare part is active in the catalog' })
  isActive!: boolean;
}

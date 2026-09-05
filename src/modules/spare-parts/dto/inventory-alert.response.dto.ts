import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SparePartCategory } from './spare-part-category.enum';
import { InventoryAlertType } from './inventory-alert-type.enum';

export class InventoryAlertResponseDto {
  @ApiProperty()
  partId!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: SparePartCategory })
  category!: SparePartCategory;

  @ApiProperty()
  physicalStock!: number;

  @ApiProperty()
  reservedStock!: number;

  @ApiProperty({ description: 'Physical stock minus reserved stock' })
  availableStock!: number;

  @ApiProperty({ description: 'Days since the last inventory movement' })
  daysWithoutMovement!: number;

  @ApiProperty({ enum: InventoryAlertType })
  alertType!: InventoryAlertType;

  @ApiPropertyOptional({ nullable: true })
  lastMovementAt!: Date | null;
}

import { ApiProperty } from '@nestjs/swagger';
import { InventoryAlertResponseDto } from './inventory-alert.response.dto';

export class ListInventoryAlertsResponseDto {
  @ApiProperty({ type: [InventoryAlertResponseDto] })
  data!: InventoryAlertResponseDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;
}

import { ApiProperty } from '@nestjs/swagger';

// HU-04: the workshop lead needs identifiers and operational data to assign an order.
export class WorkOrderListItemResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() vehicleId!: string;
  @ApiProperty() plate!: string;
  @ApiProperty() vehicleBrand!: string;
  @ApiProperty() vehicleModel!: string;
  @ApiProperty() vehicleYear!: number;
  @ApiProperty() customerName!: string;
  @ApiProperty() customerIdentification!: string;
  @ApiProperty() initialComplaint!: string;
  @ApiProperty() status!: string;
  @ApiProperty() createdAt!: Date;
  @ApiProperty({ nullable: true }) mechanicId!: string | null;
}

export class ListWorkOrdersResponseDto {
  @ApiProperty({ type: [WorkOrderListItemResponseDto] })
  data!: WorkOrderListItemResponseDto[];

  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
}

import { ApiProperty } from '@nestjs/swagger';

export class VehicleSummaryDto {
  @ApiProperty({ description: 'Vehicle brand' })
  brand!: string;

  @ApiProperty({ description: 'Vehicle model' })
  model!: string;

  @ApiProperty({ description: 'Vehicle year' })
  year!: number;
}

export class VehicleStatusResponseDto {
  @ApiProperty({ description: 'Work order id' })
  workOrderId!: string;

  @ApiProperty({ description: 'Vehicle license plate' })
  plate!: string;

  @ApiProperty({ type: VehicleSummaryDto, description: 'Vehicle summary' })
  vehicle!: VehicleSummaryDto;

  @ApiProperty({ description: 'Customer name' })
  customerName!: string;

  @ApiProperty({ description: 'Initial complaint reported by the customer' })
  initialComplaint!: string;

  @ApiProperty({ description: 'Work order creation date' })
  createdAt!: Date;

  @ApiProperty({ description: 'Current work order status' })
  status!: string;

  @ApiProperty({ description: 'Human readable stage of the attention' })
  stage!: string;

  @ApiProperty({ description: 'Whether the vehicle is ready for pickup' })
  readyForPickup!: boolean;
}

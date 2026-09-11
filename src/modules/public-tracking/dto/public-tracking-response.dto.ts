import { ApiProperty } from '@nestjs/swagger';

export class PublicTrackingResponseDto {
  @ApiProperty({ description: 'Public work order identifier' })
  workOrderNumber!: string;

  @ApiProperty({ description: 'Vehicle model' })
  vehicleModel!: string;

  @ApiProperty({ description: 'Current work order status' })
  status!: string;

  @ApiProperty({ description: 'Vehicle reception date and time' })
  receivedAt!: Date;

  @ApiProperty({ description: 'True when the vehicle can be picked up by the customer' })
  readyForPickup!: boolean;

  @ApiProperty({
    description: 'Authorized service names only. No prices, mechanics or internal notes are exposed.',
    type: [String],
  })
  tasksSummary!: string[];
}

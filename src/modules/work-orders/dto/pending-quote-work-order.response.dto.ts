import { ApiProperty } from '@nestjs/swagger';

// HU-12: a work order that is ready to be quoted (EN_DIAGNOSTICO). RN-16: this
// list must never expose cost, price or rate fields to the advisor.
export class PendingQuoteWorkOrderResponseDto {
  @ApiProperty({ description: 'Work order id' })
  id!: string;

  @ApiProperty({ description: 'Vehicle id' })
  vehicleId!: string;

  @ApiProperty({ description: 'License plate' })
  plate!: string;

  @ApiProperty({ description: 'Vehicle brand' })
  brand!: string;

  @ApiProperty({ description: 'Vehicle model' })
  model!: string;

  @ApiProperty({ description: 'Vehicle year' })
  year!: number;

  @ApiProperty({ description: 'Customer name' })
  customerName!: string;

  @ApiProperty({ description: 'Current work order status' })
  status!: string;

  @ApiProperty({ description: 'Initial complaint reported by the customer' })
  initialComplaint!: string;

  @ApiProperty({ description: 'Date when the work order was created' })
  createdAt!: Date;
}
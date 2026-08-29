import { ApiProperty } from '@nestjs/swagger';

// RN-16 / BE-12: the response for a MECHANIC must exclude any cost, price or
// rate field. This DTO deliberately contains no monetary values.
export class AssignedWorkOrderResponseDto {
  @ApiProperty({ description: 'Work order id' })
  id!: string;

  @ApiProperty({ description: 'Vehicle id' })
  vehicleId!: string;

  @ApiProperty({ description: 'Vehicle license plate' })
  plate!: string;

  @ApiProperty({ description: 'Current work order status' })
  status!: string;

  @ApiProperty({ description: 'Initial complaint reported by the customer' })
  initialComplaint!: string;

  @ApiProperty({ description: 'Date when the work order was assigned', nullable: true })
  assignedAt!: Date | null;
}

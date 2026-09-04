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

// HU-07 / RN-16: a reserved spare part line exposed to a mechanic. It carries
// no financial fields. status uses the persistence values RESERVED / INSTALLED.
export class ReservedPartLineDto {
  @ApiProperty({ description: 'Quote part id, the identifier accepted by POST /work-orders/:id/consume-part' })
  quotePartId!: string;

  @ApiProperty({ description: 'Spare part catalog code' })
  code!: string;

  @ApiProperty({ description: 'Spare part name' })
  name!: string;

  @ApiProperty({ description: 'Reserved quantity' })
  quantityReserved!: number;

  @ApiProperty({ description: 'Quantity already installed and consumed' })
  quantityUsed!: number;

  @ApiProperty({ description: 'Quote part status', enum: ['RESERVED', 'INSTALLED'] })
  status!: 'RESERVED' | 'INSTALLED';
}

// HU-07: detail of an assigned work order including its reserved spare parts.
export class AssignedWorkOrderDetailResponseDto extends AssignedWorkOrderResponseDto {
  @ApiProperty({
    description: 'Vehicle brand',
    nullable: true,
  })
  brand!: string;

  @ApiProperty({
    description: 'Vehicle model',
    nullable: true,
  })
  model!: string;

  @ApiProperty({
    description: 'Vehicle model year',
    nullable: true,
  })
  year!: number;

  @ApiProperty({ type: [ReservedPartLineDto], description: 'Reserved spare parts of the approved quote (HU-07, RN-16)' })
  reservedParts!: ReservedPartLineDto[];
}

import { ApiProperty } from '@nestjs/swagger';

// HU-13: the spare part of an approved quote exposed to the mechanic. No
// monetary field (unitPrice/subtotal) is ever selected here (RN-16 / BE-12).
export class AssignedSparePartResponseDto {
  @ApiProperty({ description: 'Spare part id' })
  id!: string;

  @ApiProperty({ description: 'Spare part code' })
  code!: string;

  @ApiProperty({ description: 'Spare part name' })
  name!: string;
}

// HU-13: an approved quote line. sparePartId is the value the mechanic sends
// as missingPartId when registering a physical stock discrepancy.
export class AssignedQuotePartResponseDto {
  @ApiProperty({ description: 'Quote part id' })
  id!: string;

  @ApiProperty({ description: 'Spare part id (missingPartId for HU-13)' })
  sparePartId!: string;

  @ApiProperty({ description: 'Quantity quoted for this part' })
  quantity!: number;

  @ApiProperty({ description: 'Current quote part status', example: 'RESERVED' })
  status!: string;

  @ApiProperty({ description: 'Spare part details' })
  sparePart!: AssignedSparePartResponseDto;
}

// HU-13: approved quote injected on assigned work orders so the awaiting part
// modal can render the associated spare parts. Only the id and the part lines
// are exposed; cost fields stay server-side (RN-16).
export class AssignedQuoteResponseDto {
  @ApiProperty({ description: 'Quote id' })
  id!: string;

  @ApiProperty({ type: [AssignedQuotePartResponseDto], description: 'Quote part lines' })
  parts!: AssignedQuotePartResponseDto[];
}

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

  @ApiProperty({ description: 'Approved quote, or null when the order has no approved quote', type: AssignedQuoteResponseDto, nullable: true })
  quote!: AssignedQuoteResponseDto | null;
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

// HU-07: detail of an assigned work order including its reserved spare parts
// and the approved quote (HU-13). vehicle is nested to honor the HU-03 e2e
// contract while brand/model/year stay flat for the HU-07 mechanic console.
export class AssignedWorkOrderDetailResponseDto extends AssignedWorkOrderResponseDto {
  @ApiProperty({ description: 'Vehicle data' })
  vehicle!: {
    plate: string;
    brand: string;
    model: string;
    year: number;
  };

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

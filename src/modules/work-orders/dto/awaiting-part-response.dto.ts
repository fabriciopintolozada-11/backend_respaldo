import { ApiProperty } from '@nestjs/swagger';

// US-13: response returned after successfully setting a work order to
// EN_ESPERA_DE_REPUESTO. Contains the confirmation fields the frontend
// needs to reflect the state change.
export class AwaitingPartResponseDto {
  @ApiProperty({ description: 'Work order id' })
  id!: string;

  @ApiProperty({ description: 'New work order status', example: 'EN_ESPERA_DE_REPUESTO' })
  status!: string;

  @ApiProperty({ description: 'UUID of the reported missing spare part' })
  missingPartId!: string;

  @ApiProperty({ description: 'Quantity of missing units' })
  quantity!: number;

  @ApiProperty({ description: 'Reason for the pause' })
  reason!: string;

  @ApiProperty({ description: 'Timestamp when the discrepancy was registered' })
  createdAt!: Date;
}

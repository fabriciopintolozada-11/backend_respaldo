import { ApiProperty } from '@nestjs/swagger';
import { WorkOrderStatus } from '../../../common/enums/work-order-status.enum';

// US-13: response returned after successfully setting a work order to
// WAITING_FOR_PART. Contains the confirmation fields the frontend
// needs to reflect the state change.
export class AwaitingPartResponseDto {
  @ApiProperty({ description: 'Work order id' })
  id!: string;

  @ApiProperty({ description: 'New work order status', example: WorkOrderStatus.WAITING_FOR_PART })
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

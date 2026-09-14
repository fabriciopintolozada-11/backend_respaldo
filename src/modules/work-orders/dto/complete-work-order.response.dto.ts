import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WorkOrderStatus } from '../../../common/enums/work-order-status.enum';

// US-19: response after concluding a repair. Confirms the new status
// (READY_FOR_DELIVERY), when the work order was completed and which physical bay
// was freed. Never exposes costs or prices (RN-16).
export class CompleteWorkOrderResponseDto {
  @ApiProperty({ description: 'Work order id' })
  id!: string;

  @ApiProperty({ description: 'New work order status', example: WorkOrderStatus.READY_FOR_DELIVERY })
  status!: string;

  @ApiProperty({ description: 'Timestamp when the repair was concluded' })
  completedAt!: Date;

  @ApiPropertyOptional({ description: 'Physical bay number freed, if any' })
  bayNumber!: number | null;

  @ApiPropertyOptional({ description: 'Final odometer mileage in km' })
  finalMileage!: number | null;

  @ApiPropertyOptional({ description: 'Mechanic closing / quality-control notes' })
  closingNotes!: string | null;
}
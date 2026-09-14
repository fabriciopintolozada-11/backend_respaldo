import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from './deliver-work-order.dto';
import { WorkOrderStatus } from '../../../common/enums/work-order-status.enum';

// US-20: response after registering the settlement and the vehicle handover
// (RN-21). Confirms the new status (DELIVERED), when it happened, the payment
// method, the receipt number and the total charged. totalCharged is
// serialized as a string to avoid float precision loss (BE-13).
export class DeliverWorkOrderResponseDto {
  @ApiProperty({ description: 'Work order id' })
  id!: string;

  @ApiProperty({ description: 'New work order status', example: WorkOrderStatus.DELIVERED })
  status!: string;

  @ApiProperty({ description: 'Timestamp when the vehicle was handed over' })
  deliveredAt!: Date;

  @ApiProperty({ enum: PaymentMethod, description: 'Payment method used at delivery (RN-21)' })
  paymentMethod!: PaymentMethod;

  @ApiProperty({ description: 'Internal receipt number of the collected payment' })
  receiptNumber!: string;

  @ApiProperty({ description: 'Total amount charged in BOB, as a string' })
  totalCharged!: string;

  @ApiPropertyOptional({ description: 'Delivery / handover notes' })
  deliveryNotes!: string | null;
}
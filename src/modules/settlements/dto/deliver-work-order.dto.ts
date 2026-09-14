import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Length, MaxLength } from 'class-validator';

// US-20 (BE-10, BE-25, RN-21): payment method accepted at the final
// settlement. BOB cash, QR/bank transfer or card are allowed.
export enum PaymentMethod {
  CASH = 'CASH',
  QR_TRANSFER = 'QR_TRANSFER',
  CARD = 'CARD',
}

// US-20: payload to settle the account and register the vehicle handover.
// receiptNumber is the internal payment receipt; deliveryNotes is optional.
// No monetary amounts come from the client: the total is always computed by
// the backend from quote data (RN-21, BE-13).
export class DeliverWorkOrderDto {
  @ApiProperty({ enum: PaymentMethod, description: 'Payment method used at delivery (RN-21)' })
  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @ApiProperty({ description: 'Internal receipt number of the collected payment', maxLength: 50 })
  @IsString()
  @Length(1, 50)
  receiptNumber!: string;

  @ApiPropertyOptional({ description: 'Delivery / handover notes', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  deliveryNotes?: string;
}
import { ApiProperty } from '@nestjs/swagger';

// US-20 / RN-15: type of settlement adjustment.
export enum AdjustmentType {
  DISCOUNT = 'DISCOUNT',
  VOID = 'VOID',
}

// US-20 / RN-15: response after applying or voiding a settlement adjustment.
export class SettlementAdjustmentResponseDto {
  @ApiProperty({ description: 'Adjustment id' })
  id!: string;

  @ApiProperty({ description: 'Work order id' })
  workOrderId!: string;

  @ApiProperty({ enum: AdjustmentType, description: 'Type of adjustment (RN-15)' })
  type!: AdjustmentType;

  @ApiProperty({ description: 'Adjustment amount in BOB, as a string with 2 decimals' })
  amount!: string;

  @ApiProperty({ description: 'Reason for the adjustment' })
  reason!: string;

  @ApiProperty({ description: 'User who applied the adjustment' })
  appliedBy!: string;

  @ApiProperty({ description: 'Timestamp when the adjustment was applied' })
  createdAt!: Date;
}

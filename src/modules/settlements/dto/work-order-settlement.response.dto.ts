import { ApiProperty } from '@nestjs/swagger';
import { AdjustmentType } from './settlement-adjustment.response.dto';

// US-20: a single installed spare part line of the settlement. Monetary
// fields are serialized as strings to avoid float precision loss (BE-13).
export class WorkOrderSettlementPartItemDto {
  @ApiProperty({ description: 'Quote part line id' })
  id!: string;

  @ApiProperty({ description: 'Spare part code' })
  code!: string;

  @ApiProperty({ description: 'Spare part name' })
  name!: string;

  @ApiProperty({ description: 'Installed quantity' })
  quantity!: number;

  @ApiProperty({ description: 'Unit price in BOB, as a string' })
  unitPrice!: string;

  @ApiProperty({ description: 'Line subtotal in BOB, as a string' })
  subtotal!: string;
}

// US-20 / RN-15: summary of a single settlement adjustment for the settlement view.
export class SettlementAdjustmentSummaryDto {
  @ApiProperty({ description: 'Adjustment id' })
  id!: string;

  @ApiProperty({ enum: AdjustmentType, description: 'Adjustment type', example: 'DISCOUNT' })
  type!: AdjustmentType;

  @ApiProperty({ description: 'Adjustment amount in BOB, as a string' })
  amount!: string;

  @ApiProperty({ description: 'Reason for the adjustment' })
  reason!: string;

  @ApiProperty({ description: 'Timestamp when the adjustment was applied' })
  createdAt!: Date;
}

// US-20: consolidated settlement of a work order ready to be delivered
// (RN-21). Only INSTALLED spare parts are charged; the total equals labor
// subtotal plus installed parts subtotal. Monetary fields are strings (BE-13).
export class WorkOrderSettlementResponseDto {
  @ApiProperty({ description: 'Work order id' })
  workOrderId!: string;

  @ApiProperty({ description: 'Work order status', example: 'LISTO_ENTREGA' })
  status!: string;

  @ApiProperty({ description: 'Vehicle license plate' })
  plate!: string;

  @ApiProperty({ description: 'Vehicle brand' })
  brand!: string;

  @ApiProperty({ description: 'Vehicle model' })
  model!: string;

  @ApiProperty({ description: 'Vehicle year' })
  year!: number;

  @ApiProperty({ description: 'Customer name' })
  customerName!: string;

  @ApiProperty({ description: 'Labor subtotal in BOB (approved hours x rate), as a string' })
  laborSubtotal!: string;

  @ApiProperty({ type: [WorkOrderSettlementPartItemDto], description: 'Installed spare part lines' })
  parts!: WorkOrderSettlementPartItemDto[];

  @ApiProperty({ description: 'Installed parts subtotal in BOB, as a string' })
  partsSubtotal!: string;

  @ApiProperty({ description: 'Total to settle in BOB, as a string' })
  total!: string;

  @ApiProperty({ description: 'Settlement currency', example: 'BOB' })
  currency!: string;

  @ApiProperty({ description: 'Total discounts applied in BOB, as a string' })
  discountsTotal!: string;

  @ApiProperty({ description: 'Final total after discounts in BOB, as a string' })
  totalAfterDiscounts!: string;

  @ApiProperty({ type: [SettlementAdjustmentSummaryDto], description: 'Applied adjustments history' })
  adjustments!: SettlementAdjustmentSummaryDto[];
}
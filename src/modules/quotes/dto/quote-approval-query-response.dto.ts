import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QuoteItemType } from './create-quote.dto';

export class QuoteApprovalListItemResponseDto {
  @ApiProperty() orderId!: string;
  @ApiPropertyOptional({ nullable: true, description: 'Legacy OT code; null when the database has no OT code' })
  orderCode!: string | null;
  @ApiProperty() vehiclePlate!: string;
  @ApiProperty() vehicleDescription!: string;
  @ApiProperty() clientName!: string;
  @ApiProperty() status!: string;
  @ApiProperty() totalBOB!: string;
  @ApiProperty() isFullyElectric!: boolean;
}

export class ListQuoteApprovalResponseDto {
  @ApiProperty({ type: [QuoteApprovalListItemResponseDto] })
  data!: QuoteApprovalListItemResponseDto[];

  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
}

export class QuoteApprovalItemResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ enum: QuoteItemType }) itemType!: QuoteItemType;
  @ApiProperty() quantity!: string;
  @ApiProperty() unitPrice!: string;
  @ApiProperty() subtotal!: string;
  @ApiProperty() status!: string;
  @ApiPropertyOptional() code?: string;
}

export class QuoteApprovalWorkOrderResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() status!: string;
  @ApiProperty() vehiclePlate!: string;
  @ApiProperty() vehicleBrand!: string;
  @ApiProperty() vehicleModel!: string;
  @ApiProperty() vehicleYear!: number;
  @ApiProperty() clientName!: string;
  @ApiProperty() clientDocument!: string;
  @ApiPropertyOptional({ nullable: true }) clientPhone!: string | null;
  @ApiProperty() entryReason!: string;
  @ApiProperty() createdAt!: Date;
}

export class QuoteApprovalBudgetResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() workOrderId!: string;
  @ApiProperty() total!: string;
  @ApiProperty() laborSubtotal!: string;
  @ApiProperty() partsSubtotal!: string;
  @ApiProperty() currency!: string;
  @ApiProperty() status!: string;
  @ApiProperty() createdAt!: Date;
}

export class QuoteApprovalDetailResponseDto {
  @ApiProperty() quoteId!: string;
  @ApiProperty() workOrderId!: string;
  @ApiProperty({ type: QuoteApprovalWorkOrderResponseDto }) workOrder!: QuoteApprovalWorkOrderResponseDto;
  @ApiProperty({ type: QuoteApprovalBudgetResponseDto }) budget!: QuoteApprovalBudgetResponseDto;
  @ApiProperty({ type: [QuoteApprovalItemResponseDto] }) items!: QuoteApprovalItemResponseDto[];
  @ApiProperty() isFullyElectric!: boolean;
}

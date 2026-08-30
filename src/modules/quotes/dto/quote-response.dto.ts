import { ApiProperty } from '@nestjs/swagger';
import { QuoteItemType } from './create-quote.dto';

export class QuoteDetailResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ enum: QuoteItemType }) itemType!: QuoteItemType;
  @ApiProperty() quantity!: string;
  @ApiProperty() unitPrice!: string;
  @ApiProperty() subtotal!: string;
}

export class QuoteResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() workOrderId!: string;
  @ApiProperty({ type: [QuoteDetailResponseDto] }) items!: QuoteDetailResponseDto[];
  @ApiProperty() total!: string;
  @ApiProperty({ example: 'BOB' }) currency!: string;
  @ApiProperty() createdAt!: Date;
}

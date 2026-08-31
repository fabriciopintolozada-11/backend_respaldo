import { ApiProperty } from '@nestjs/swagger';
import { ApprovalChannel } from './approve-quote.dto';

export enum QuoteDecision {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export class QuoteDecisionResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() quoteId!: string;
  @ApiProperty() workOrderId!: string;
  @ApiProperty({ enum: QuoteDecision }) decision!: QuoteDecision;
  @ApiProperty({ enum: ApprovalChannel, required: false }) channel?: ApprovalChannel;
  @ApiProperty({ required: false }) customerName?: string;
  @ApiProperty({ required: false }) notes?: string;
  @ApiProperty({ required: false }) reason?: string;
  @ApiProperty() createdAt!: Date;
}

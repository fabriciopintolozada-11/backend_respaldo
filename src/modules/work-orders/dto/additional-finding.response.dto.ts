import { ApiProperty } from '@nestjs/swagger';

// US-21: an annex of the active work order. No monetary field is serialized;
// the reception form reconstructs the supplementary budget from the mechanic's
// description and missing accessory codes (RN-16) and the mechanic never sees
// costs. Only the two decision states exist after PENDING_QUOTE.
export class AdditionalFindingResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() workOrderId!: string;
  @ApiProperty({ description: 'Unforeseen failure detected during repair' }) description!: string;
  @ApiProperty({ type: [String], description: 'Suggested tasks to repair the unforeseen failure' }) suggestedTasks!: string[];
  @ApiProperty({ type: [String], description: 'Spare part catalog ids required for the supplementary work' }) suggestedPartIds!: string[];
  @ApiProperty({ description: 'Estimated hours of supplementary labor' }) estimatedHours!: number;
  @ApiProperty({ enum: ['PENDING_QUOTE', 'APPROVED', 'REJECTED'], description: 'Decision state of the annex' })
  status!: string;
  @ApiProperty({ description: 'Mechanic who reported the unforeseen failure' }) reportedBy!: string;
  @ApiProperty({ nullable: true, description: 'Receptionist or workshop lead who decided the annex' }) decidedBy!: string | null;
  @ApiProperty({ nullable: true }) decidedAt!: Date | null;
  @ApiProperty({ nullable: true, enum: ['CALL', 'WHATSAPP', 'IN_PERSON'], description: 'Channel used when the customer approved the additional quote' })
  channel!: string | null;
  @ApiProperty({ nullable: true }) customerName!: string | null;
  @ApiProperty({ nullable: true }) notes!: string | null;
  @ApiProperty({ nullable: true, description: 'RN-19: reason for rejecting the additional quote' }) rejectionReason!: string | null;
  @ApiProperty() createdAt!: Date;
}
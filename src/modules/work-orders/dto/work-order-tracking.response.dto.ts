import { ApiProperty } from '@nestjs/swagger';

// BE-T05.2: tracking card shown in reception and to the workshop lead. The
// suspension details (missingPartName, pausedReason, daysWaitingApproval) are
// only populated when the order is paused (US-13 / RN-05 or awaiting customer
// approval). No financial fields are serialized (RN-16).
export class WorkOrderTrackingResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() plate!: string;
  @ApiProperty() model!: string;
  @ApiProperty() status!: string;
  @ApiProperty({ description: 'Vehicle entry date (immutable ingestion date)' }) entryDate!: Date;
  @ApiProperty({ description: 'Total days the vehicle has been in the workshop' }) daysInWorkshop!: number;
  @ApiProperty({ nullable: true }) bayId!: string | null;
  @ApiProperty({ nullable: true }) bayNumber!: number | null;
  @ApiProperty({ nullable: true }) mechanicName!: string | null;
  @ApiProperty({ nullable: true }) customerPhone!: string | null;
  @ApiProperty({ nullable: true }) missingPartName!: string | null;
  @ApiProperty({ nullable: true }) pausedReason!: string | null;
  @ApiProperty({ nullable: true }) daysWaitingApproval!: number | null;
}
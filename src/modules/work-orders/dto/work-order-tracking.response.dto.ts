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
  // BE-T16.2 (US-16 / RN-06): true when the work order stayed in
  // PRESUPUESTO_ENVIADO for 15+ days without an approval or rejection.
  @ApiProperty({
    default: false,
    description: 'RN-06: the order has been awaiting quote approval for 15+ days',
  })
  isStaleQuote!: boolean;
  // US-21 / BE-T21.1: an additional finding reported during repair (HU-11 /
  // RN-03) is awaiting the reception decision. The reception card renders the
  // badge "Ampliación de Presupuesto Pendiente" and the mechanic description.
  @ApiProperty({
    default: false,
    description: 'US-21: the order has an additional finding pending quote approval',
  })
  hasPendingAdditionalFinding!: boolean;
  @ApiProperty({
    nullable: true,
    description: 'US-21: description of the pending additional finding',
  })
  additionalFindingDescription!: string | null;
}

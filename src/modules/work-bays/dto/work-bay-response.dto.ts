import { ApiProperty } from '@nestjs/swagger';

// US-18: serialize the active work order associated with a bay for the
// monitoring dashboard. Non-financial allowlist only (RN-16).
export class WorkOrderBaySummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() status!: string;
  @ApiProperty() plate!: string | null;
  @ApiProperty() vehicleBrand!: string | null;
  @ApiProperty() vehicleModel!: string | null;
  @ApiProperty() mechanicId!: string | null;
  @ApiProperty() mechanicName!: string | null;
  @ApiProperty() assignedAt!: Date | null;
  @ApiProperty() elapsedHours!: number;
}

export class WorkBayMonitoringResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() bayNumber!: number;
  @ApiProperty() isOccupied!: boolean;
  // Coarse physical status aligned with the frontend BayStatus contract:
  // LIBRE | OCUPADA | ESPERA_REPUESTO | MANTENIMIENTO.
  @ApiProperty() status!: string;
  @ApiProperty() currentWorkOrderId!: string | null;
  @ApiProperty() currentWorkOrder!: WorkOrderBaySummaryDto | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
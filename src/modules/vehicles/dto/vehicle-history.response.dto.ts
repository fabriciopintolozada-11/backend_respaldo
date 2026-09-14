import { ApiProperty } from '@nestjs/swagger';

// BE-T05.3: previous delivered work orders of a vehicle, with their immutable
// diagnosis, installed spare parts and immutably-recorded dates (RN-19).

export class VehicleHistoryCustomerDto {
  @ApiProperty() id!: string;
  @ApiProperty() identification!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ nullable: true }) phone!: string | null;
}

export class VehicleHistoryTechnicalEntryDto {
  @ApiProperty() id!: string;
  @ApiProperty() description!: string;
  @ApiProperty() createdAt!: Date;
}

export class VehicleHistoryDiagnosticDto {
  @ApiProperty() id!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ type: [String] }) suggestedTasks!: string[];
  @ApiProperty() estimatedHours!: number;
  @ApiProperty() createdAt!: Date;
}

export class VehicleHistoryConsumedPartDto {
  @ApiProperty() sparePartId!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty() quantity!: number;
  @ApiProperty({ description: 'Immutable consumption (kardex) date' }) createdAt!: Date;
}

export class VehicleWorkOrderHistoryDto {
  @ApiProperty() id!: string;
  @ApiProperty() status!: string;
  @ApiProperty({ description: 'Work order creation (vehicle entry) date' }) createdAt!: Date;
  @ApiProperty({ nullable: true, type: VehicleHistoryDiagnosticDto }) diagnostic!: VehicleHistoryDiagnosticDto | null;
  @ApiProperty({ type: [VehicleHistoryConsumedPartDto] }) consumedParts!: VehicleHistoryConsumedPartDto[];
}

export class VehicleHistoryResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() plate!: string;
  @ApiProperty() brand!: string;
  @ApiProperty() model!: string;
  @ApiProperty() year!: number;
  @ApiProperty() isFullyElectric!: boolean;
  @ApiProperty() customerId!: string;
  @ApiProperty({ type: VehicleHistoryCustomerDto }) customer!: VehicleHistoryCustomerDto;
  @ApiProperty({ type: [VehicleHistoryTechnicalEntryDto] }) technicalHistory!: VehicleHistoryTechnicalEntryDto[];
  @ApiProperty({ type: [VehicleWorkOrderHistoryDto] }) workOrders!: VehicleWorkOrderHistoryDto[];
}
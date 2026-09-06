import { ApiProperty } from '@nestjs/swagger';

// BE-02.3 (US-02 / RN-17): public privacy-preserving vehicle status payload.
// Only these fields are exposed; customer names, phones, diagnostics, prices
// and any other work-order internal data are deliberately omitted.
export class PublicVehicleSummaryDto {
  @ApiProperty({ description: 'Marca del vehículo' })
  brand!: string;

  @ApiProperty({ description: 'Modelo del vehículo' })
  model!: string;

  @ApiProperty({ description: 'Año del vehículo' })
  year!: number;
}

export class PublicVehicleStatusResponseDto {
  @ApiProperty({ description: 'Identificador de la Orden de Trabajo' })
  workOrderId!: string;

  @ApiProperty({ description: 'Placa del vehículo' })
  plate!: string;

  @ApiProperty({ type: PublicVehicleSummaryDto, description: 'Resumen del vehículo' })
  vehicle!: PublicVehicleSummaryDto;

  @ApiProperty({ description: 'Fecha de creación de la Orden de Trabajo' })
  createdAt!: Date;

  @ApiProperty({ description: 'Estado actual de la Orden de Trabajo' })
  status!: string;

  @ApiProperty({ description: 'Etapa legible de la atención' })
  stage!: string;

  @ApiProperty({ description: 'Indica si el vehículo está listo para ser retirado' })
  readyForPickup!: boolean;
}

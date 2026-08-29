import { ApiProperty } from '@nestjs/swagger';

export class VehicleSummaryDto {
  @ApiProperty({ description: 'Marca del vehículo' })
  brand!: string;

  @ApiProperty({ description: 'Modelo del vehículo' })
  model!: string;

  @ApiProperty({ description: 'Año del vehículo' })
  year!: number;
}

export class VehicleStatusResponseDto {
  @ApiProperty({ description: 'Identificador de la Orden de Trabajo' })
  workOrderId!: string;

  @ApiProperty({ description: 'Placa del vehículo' })
  plate!: string;

  @ApiProperty({ type: VehicleSummaryDto, description: 'Resumen del vehículo' })
  vehicle!: VehicleSummaryDto;

  @ApiProperty({ description: 'Fecha de creación de la Orden de Trabajo' })
  createdAt!: Date;

  @ApiProperty({ description: 'Estado actual de la Orden de Trabajo' })
  status!: string;

  @ApiProperty({ description: 'Etapa legible de la atención' })
  stage!: string;

  @ApiProperty({ description: 'Indica si el vehículo está listo para ser retirado' })
  readyForPickup!: boolean;
}

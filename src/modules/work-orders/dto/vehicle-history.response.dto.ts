import { ApiProperty } from '@nestjs/swagger';

export class TechnicalHistoryEntryDto {
  @ApiProperty({ description: 'Descripción técnica del registro histórico' })
  description!: string;

  @ApiProperty({ description: 'Fecha de creación del registro' })
  createdAt!: Date;
}

export class VehicleHistoryWorkOrderDto {
  @ApiProperty({ description: 'Identificador de la Orden de Trabajo' })
  id!: string;

  @ApiProperty({ description: 'Estado de la Orden de Trabajo' })
  status!: string;

  @ApiProperty({ description: 'Fecha de creación de la Orden de Trabajo' })
  createdAt!: Date;

  @ApiProperty({ description: 'Fecha de última actualización de la Orden de Trabajo' })
  updatedAt!: Date;
}

export class VehicleHistoryResponseDto {
  @ApiProperty({ description: 'Placa del vehículo' })
  plate!: string;

  @ApiProperty({ description: 'Marca del vehículo' })
  brand!: string;

  @ApiProperty({ description: 'Modelo del vehículo' })
  model!: string;

  @ApiProperty({ description: 'Año del vehículo' })
  year!: number;

  @ApiProperty({ type: [TechnicalHistoryEntryDto], description: 'Historial técnico permanente' })
  technicalHistory!: TechnicalHistoryEntryDto[];

  @ApiProperty({ type: [VehicleHistoryWorkOrderDto], description: 'Órdenes de Trabajo relacionadas' })
  workOrders!: VehicleHistoryWorkOrderDto[];
}

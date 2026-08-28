import { ApiProperty } from '@nestjs/swagger';

// RN-16 / BE-12: the mechanic-facing detail response must exclude any cost,
// price or rate field. This DTO deliberately contains no monetary values.
export class AssignedWorkOrderDetailResponseDto {
  @ApiProperty({ description: 'Identificador de la Orden de Trabajo' })
  id!: string;

  @ApiProperty({ description: 'Identificador del vehículo' })
  vehicleId!: string;

  @ApiProperty({ description: 'Placa del vehículo' })
  plate!: string;

  @ApiProperty({ description: 'Marca del vehículo' })
  brand!: string;

  @ApiProperty({ description: 'Modelo del vehículo' })
  model!: string;

  @ApiProperty({ description: 'Año del vehículo' })
  year!: number;

  @ApiProperty({ description: 'Estado actual de la Orden de Trabajo' })
  status!: string;

  @ApiProperty({ description: 'Reclamo inicial reportado por el cliente' })
  initialComplaint!: string;

  @ApiProperty({ description: 'Fecha de asignación de la Orden de Trabajo', nullable: true })
  assignedAt!: Date | null;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class VehiclePlateParamDto {
  @ApiProperty({ description: 'Placa del vehículo', example: 'ABC-123' })
  @IsString()
  @Matches(/^[A-Z0-9-]{3,10}$/i)
  plate!: string;
}

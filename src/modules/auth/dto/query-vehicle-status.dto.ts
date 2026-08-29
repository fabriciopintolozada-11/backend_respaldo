import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class QueryVehicleStatusDto {
  @ApiProperty({
    description: 'Placa del vehículo para la consulta pública (RN-17)',
    example: '1234ABC',
  })
  @IsString()
  @Matches(/^[A-Z0-9-]{3,10}$/i)
  plate!: string;

  @ApiProperty({
    description: 'Documento de identidad del cliente para la consulta pública (RN-17)',
    example: '1234567',
  })
  @IsString()
  @IsNotEmpty()
  customerIdentification!: string;
}

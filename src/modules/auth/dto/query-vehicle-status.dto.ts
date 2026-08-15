import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class QueryVehicleStatusDto {
  @ApiProperty({
    description: 'Vehicle license plate used for the public lookup (RN-17)',
    example: '1234ABC',
  })
  @IsString()
  @Matches(/^[A-Z0-9-]{3,10}$/i)
  plate!: string;

  @ApiProperty({
    description: 'Customer identification document used for the public lookup (RN-17)',
    example: '1234567',
  })
  @IsString()
  @IsNotEmpty()
  identification!: string;
}

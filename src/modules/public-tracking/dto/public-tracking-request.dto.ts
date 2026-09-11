import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class PublicTrackingRequestDto {
  @ApiProperty({
    description: 'Vehicle license plate used for the public tracking lookup (RN-17)',
    example: '1234ABC',
  })
  @IsString()
  @IsNotEmpty()
  licensePlate!: string;

  @ApiProperty({
    description: 'Customer national identification number used for the public tracking lookup (RN-17)',
    example: '1234567',
  })
  @IsString()
  @IsNotEmpty()
  nationalId!: string;
}

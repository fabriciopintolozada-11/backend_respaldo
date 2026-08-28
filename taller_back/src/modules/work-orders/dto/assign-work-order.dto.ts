import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AssignWorkOrderDto {
  @ApiProperty() @IsUUID() mechanicId!: string;
}

export class AssignWorkOrderResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() mechanicId!: string;
  @ApiProperty() status!: string;
  @ApiProperty() updatedAt!: Date;
}

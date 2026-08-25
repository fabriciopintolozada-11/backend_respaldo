import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class WorkOrderIdParamDto {
  @ApiProperty({ description: 'Identificador de la Orden de Trabajo', format: 'uuid' })
  @IsUUID()
  id!: string;
}

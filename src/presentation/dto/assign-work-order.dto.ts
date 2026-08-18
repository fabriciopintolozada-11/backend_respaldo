import { IsDefined, IsUUID } from 'class-validator';

export class AssignWorkOrderDto {
  @IsDefined()
  @IsUUID()
  mecanicoId!: string;
}

export class AssignWorkOrderResponseDto {
  id!: string;
  mecanicoId!: string;
  status!: 'ASIGNADA';
  updatedAt!: Date;
}

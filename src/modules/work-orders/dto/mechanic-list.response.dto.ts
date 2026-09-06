import { ApiProperty } from '@nestjs/swagger';

export class MechanicListItemResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() isActive!: boolean;
  @ApiProperty({ description: 'Nombre del mecánico desde la tabla de usuarios (null si no hay coincidencia).', required: false, nullable: true })
  name!: string | null;
}

export class ListMechanicsResponseDto {
  @ApiProperty({ type: [MechanicListItemResponseDto] })
  data!: MechanicListItemResponseDto[];

  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
}

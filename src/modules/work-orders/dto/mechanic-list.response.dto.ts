import { ApiProperty } from '@nestjs/swagger';

export class MechanicListItemResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() isActive!: boolean;
}

export class ListMechanicsResponseDto {
  @ApiProperty({ type: [MechanicListItemResponseDto] })
  data!: MechanicListItemResponseDto[];

  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
}

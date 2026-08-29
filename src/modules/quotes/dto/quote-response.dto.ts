import { ApiProperty } from '@nestjs/swagger';

export class QuoteResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() workOrderId!: string;
  @ApiProperty() laborItems!: unknown[];
  @ApiProperty() laborSubtotal!: string;
  @ApiProperty() partsSubtotal!: string;
  @ApiProperty() total!: string;
  @ApiProperty({ example: 'BOB' }) currency!: string;
  @ApiProperty() createdAt!: Date;
}

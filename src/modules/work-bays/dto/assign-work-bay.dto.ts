import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

// US-18 / RN-14: manual assignment of a work order to a bay,
// performed exclusively by the workshop lead or an admin.
export class AssignWorkBayDto {
  @ApiProperty() @IsUUID() workOrderId!: string;
}

export class AssignWorkBayResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() bayNumber!: number;
  @ApiProperty() isOccupied!: boolean;
  @ApiProperty() currentWorkOrderId!: string | null;
  @ApiProperty() updatedAt!: Date;
}
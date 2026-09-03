import { ApiProperty } from '@nestjs/swagger';

// HU-07 / RN-16: strict allowlist for a spare part line returned to the
// mechanic. It exposes only code, name, quantity and status. Financial fields
// (unitPrice, subtotal) are never included.
export class WorkOrderPartResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty() quantity!: number;
  @ApiProperty() status!: string;
}

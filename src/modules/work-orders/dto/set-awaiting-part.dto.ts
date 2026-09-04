import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, IsUUID, Min, Matches } from 'class-validator';

// US-13: payload to register a missing spare part and set the work order to
// EN_ESPERA_DE_REPUESTO. The frontend (awaiting-part-api.ts) sends
// missingPartId, quantity and reason — all three fields are required.
export class SetAwaitingPartDto {
  @ApiProperty({ description: 'UUID of the spare part that is physically unavailable', format: 'uuid' })
  @IsUUID('4')
  missingPartId!: string;

  @ApiProperty({ description: 'Number of units missing', minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiProperty({ description: 'Reason why the part is unavailable' })
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'reason must contain non-whitespace characters' })
  reason!: string;
}

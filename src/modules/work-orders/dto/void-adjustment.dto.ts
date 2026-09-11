import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, MinLength, MaxLength, Matches } from 'class-validator';

// US-20 / RN-15: payload to void (reverse) a previously applied discount.
// Creates a new VOID record that reverts the effect of the original DISCOUNT.
export class VoidAdjustmentDto {
  @ApiProperty({ description: 'UUID of the discount adjustment to void (RN-15)', format: 'uuid' })
  @IsUUID('4')
  adjustmentId!: string;

  @ApiProperty({ description: 'Mandatory reason for the void (10-500 chars)', minLength: 10, maxLength: 500 })
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  @Matches(/\S/, { message: 'reason must contain non-whitespace characters' })
  reason!: string;
}

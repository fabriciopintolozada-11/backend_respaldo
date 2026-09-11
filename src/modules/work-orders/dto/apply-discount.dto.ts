import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, Max, Min, MinLength, MaxLength, Matches } from 'class-validator';

// US-20 / RN-15: payload to apply a discount on the settlement of a work order.
// Only WORKSHOP_LEAD may perform this operation (RN-15).
export class ApplyDiscountDto {
  @ApiProperty({ description: 'Discount amount in BOB (RN-15)', minimum: 0.01, maximum: 999999.99 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999999.99)
  amount!: number;

  @ApiProperty({ description: 'Mandatory reason for the discount (10-500 chars)', minLength: 10, maxLength: 500 })
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  @Matches(/\S/, { message: 'reason must contain non-whitespace characters' })
  reason!: string;
}

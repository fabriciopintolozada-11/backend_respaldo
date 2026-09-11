import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

// US-21 (BE-T21.2): the reception rejects the additional quote. The reason is
// archived permanently (RN-19) with the label "Daño no reparado por decisión
// del cliente".
export class RejectAdditionalFindingDto {
  @ApiProperty({ minLength: 3, maxLength: 1000, description: 'Reason why the customer declined the additional quote' })
  @IsString()
  @Matches(/\S/, { message: 'reason must contain non-whitespace characters' })
  @Length(3, 1000)
  reason!: string;
}
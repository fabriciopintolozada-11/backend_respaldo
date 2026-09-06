import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class RejectQuoteDto {
  @ApiProperty({ minLength: 3, maxLength: 1000 })
  @IsString()
  @Length(3, 1000)
  reason!: string;
}

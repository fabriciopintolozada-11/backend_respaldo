import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, Length } from 'class-validator';

export enum ApprovalChannel {
  CALL = 'CALL',
  WHATSAPP = 'WHATSAPP',
  IN_PERSON = 'IN_PERSON',
}

export class ApproveQuoteDto {
  @ApiProperty({ enum: ApprovalChannel, description: 'Communication channel used by the customer' })
  @IsEnum(ApprovalChannel)
  channel!: ApprovalChannel;

  @ApiProperty({ minLength: 3, maxLength: 150 })
  @IsString()
  @Length(3, 150)
  customerName!: string;

  @ApiProperty({ minLength: 3, maxLength: 2000 })
  @IsString()
  @Length(3, 2000)
  notes!: string;
}

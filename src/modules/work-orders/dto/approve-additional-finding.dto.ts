import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, Length } from 'class-validator';
import { ApprovalChannel } from '../../quotes/dto/approve-quote.dto';

// US-21 (BE-T21.2): the reception approves the supplementary budget exactly
// like HU-09, registering the communication channel used with the customer.
export class ApproveAdditionalFindingDto {
  @ApiProperty({ enum: ApprovalChannel, description: 'Communication channel used by the customer' })
  @IsEnum(ApprovalChannel)
  channel!: ApprovalChannel;

  @ApiProperty({ minLength: 3, maxLength: 150 })
  @IsString()
  @Length(3, 150)
  customerName!: string;

  @ApiProperty({ minLength: 3, maxLength: 2000, required: false })
  @IsString()
  @Length(3, 2000)
  notes!: string;
}
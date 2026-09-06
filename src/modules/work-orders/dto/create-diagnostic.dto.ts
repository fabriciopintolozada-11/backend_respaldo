import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNumber, IsString, IsUUID, Length, Matches, Min } from 'class-validator';

export class CreateDiagnosticDto {
  @ApiProperty()
  @IsString()
  @Matches(/\S/, { message: 'description must contain non-whitespace characters' })
  @Length(3, 2000)
  description!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  suggestedTasks!: string[];

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  suggestedPartIds!: string[];

  @ApiProperty({ minimum: 0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  estimatedHours!: number;
}

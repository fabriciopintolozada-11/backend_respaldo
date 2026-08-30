import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEnum, IsNumber, IsString, Length, Min, ValidateNested } from 'class-validator';

export enum QuoteItemType {
  LABOR = 'LABOR',
  PART = 'PART',
}

export class CreateQuoteItemDto {
  @ApiProperty({ minLength: 3, maxLength: 255 })
  @IsString()
  @Length(3, 255)
  description!: string;

  @ApiProperty({ enum: QuoteItemType })
  @IsEnum(QuoteItemType)
  itemType!: QuoteItemType;

  @ApiProperty({ minimum: 0.01 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  quantity!: number;

  @ApiProperty({ minimum: 0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice!: number;
}

export class CreateQuoteDto {
  @ApiProperty({ type: [CreateQuoteItemDto], minItems: 1 })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateQuoteItemDto)
  items!: CreateQuoteItemDto[];
}

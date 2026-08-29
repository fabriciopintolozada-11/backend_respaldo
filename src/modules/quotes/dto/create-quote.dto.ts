import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNumber, IsString, IsUUID, Length, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class QuoteLaborItemDto {
  @ApiProperty() @IsString() @Length(3, 255) description!: string;
  @ApiProperty() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) hours!: number;
}

export class QuotePartItemDto {
  @ApiProperty() @IsUUID('4') sparePartId!: string;
  @ApiProperty() @IsNumber() @Min(1) quantity!: number;
}

export class CreateQuoteDto {
  @ApiProperty({ type: [QuoteLaborItemDto] }) @IsArray() @ValidateNested({ each: true }) @Type(() => QuoteLaborItemDto) laborItems!: QuoteLaborItemDto[];
  @ApiProperty({ type: [QuotePartItemDto] }) @IsArray() @ValidateNested({ each: true }) @Type(() => QuotePartItemDto) partItems!: QuotePartItemDto[];
}

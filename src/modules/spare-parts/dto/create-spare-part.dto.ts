import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNumber, IsString, Length, Max, Min } from 'class-validator';
import { SparePartCategory } from './spare-part-category.enum';

export class CreateSparePartDto {
  @ApiProperty({ maxLength: 50 })
  @IsString()
  @Length(1, 50)
  code!: string;

  @ApiProperty({ maxLength: 150 })
  @IsString()
  @Length(1, 150)
  name!: string;

  @ApiProperty({ enum: SparePartCategory })
  @IsEnum(SparePartCategory)
  category!: SparePartCategory;

  @ApiProperty({ minimum: 0, description: 'Official unit price in BOB' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999999999.99)
  unitPrice!: number;

  @ApiProperty({ minimum: 0, description: 'Initial physical stock' })
  @IsInt()
  @Min(0)
  initialStock!: number;
}

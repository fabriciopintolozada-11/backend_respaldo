import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { InventoryAlertType } from './inventory-alert-type.enum';
import { SparePartCategory } from './spare-part-category.enum';

export class QueryInventoryAlertsDto {
  @ApiPropertyOptional({ enum: InventoryAlertType })
  @IsOptional()
  @IsEnum(InventoryAlertType)
  alertType?: InventoryAlertType;

  @ApiPropertyOptional({ enum: SparePartCategory })
  @IsOptional()
  @IsEnum(SparePartCategory)
  category?: SparePartCategory;

  @ApiPropertyOptional({ description: 'Search by spare part code or name', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  Validate,
  ValidateNested,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

export enum QuoteItemType {
  LABOR = 'LABOR',
  PART = 'PART',
}

// BE-12.4 (HU-12): part quantities must be whole units while labor hours may be
// decimals. Validation is applied depending on the item type.
@ValidatorConstraint({ name: 'quoteItemQuantity', async: false })
class QuoteItemQuantityConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const item = args.object as CreateQuoteItemDto;
    if (item.itemType === QuoteItemType.PART) {
      return Number.isInteger(item.quantity) && item.quantity > 0;
    }
    return typeof item.quantity === 'number' && item.quantity > 0;
  }

  defaultMessage(args: ValidationArguments): string {
    const item = args.object as CreateQuoteItemDto;
    return item.itemType === QuoteItemType.PART
      ? 'quantity must be a positive integer for PART items'
      : 'quantity (labor hours) must be a positive number for LABOR items';
  }
}

// BE-12.4 (HU-12): the spare parts array must not contain duplicates.
@ValidatorConstraint({ name: 'quoteItemsNoDuplicateParts', async: false })
class QuoteItemsNoDuplicatePartsConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    const items = args.object as CreateQuoteDto;
    const partIds = items.items
      .filter((item) => item.itemType === QuoteItemType.PART && item.sparePartId)
      .map((item) => item.sparePartId);
    return new Set(partIds).size === partIds.length;
  }

  defaultMessage(): string {
    return 'spare parts must not be duplicated in the items array';
  }
}

export class CreateQuoteItemDto {
  @ApiProperty({ minLength: 3, maxLength: 255 })
  @IsString()
  @Length(3, 255)
  description!: string;

  @ApiProperty({ enum: QuoteItemType })
  @IsEnum(QuoteItemType)
  itemType!: QuoteItemType;

  @ApiProperty({ required: false, format: 'uuid', description: 'Required for PART items' })
  @IsOptional()
  @IsUUID()
  sparePartId?: string;

  // BE-12.4: for PART items it is the unit quantity (integer); for LABOR items it
  // is the labor hours and may accept decimals.
  @ApiProperty({ minimum: 0.01, description: 'Cantidad de repuestos (entero) u horas de mano de obra (decimal)' })
  @Validate(QuoteItemQuantityConstraint)
  quantity!: number;

  @ApiProperty({ required: false, description: 'Precio unitario enviado por el frontend; el backend lo ignora y usa el precio oficial (BE-12.5)' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice?: number;
}

export class CreateQuoteDto {
  @ApiProperty({ type: [CreateQuoteItemDto], minItems: 1 })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateQuoteItemDto)
  @Validate(QuoteItemsNoDuplicatePartsConstraint)
  items!: CreateQuoteItemDto[];
}

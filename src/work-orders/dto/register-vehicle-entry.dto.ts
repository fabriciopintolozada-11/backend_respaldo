import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, Min, ValidateNested } from 'class-validator';

export class CustomerDto {
  @IsString() @IsNotEmpty() identification!: string;
  @IsString() @IsNotEmpty() name!: string;
  @IsOptional() @IsString() phone?: string;
}

export class VehicleDto {
  @IsString() @IsNotEmpty() brand!: string;
  @IsString() @IsNotEmpty() model!: string;
  @Type(() => Number) @IsInt() @Min(1900) @Max(2100) year!: number;
  @IsBoolean() isFullyElectric!: boolean;
}

export class RegisterVehicleEntryDto {
  @IsString() @Matches(/^[A-Z0-9-]{3,10}$/i) plate!: string;
  @ValidateNested() @Type(() => CustomerDto) customer!: CustomerDto;
  @ValidateNested() @Type(() => VehicleDto) vehicle!: VehicleDto;
  @IsString() @IsNotEmpty() initialComplaint!: string;
}

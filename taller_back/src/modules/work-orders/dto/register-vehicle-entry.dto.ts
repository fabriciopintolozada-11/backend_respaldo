import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, Min, ValidateNested } from 'class-validator';

export class CustomerDto {
  @ApiProperty() @IsString() @IsNotEmpty() identification!: string;
  @ApiProperty() @IsString() @IsNotEmpty() name!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() phone?: string;
}

export class VehicleDto {
  @ApiProperty() @IsString() @IsNotEmpty() brand!: string;
  @ApiProperty() @IsString() @IsNotEmpty() model!: string;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1900) @Max(2100) year!: number;
  @ApiProperty() @IsBoolean() isFullyElectric!: boolean;
}

export class RegisterVehicleEntryDto {
  @ApiProperty() @IsString() @Matches(/^[A-Z0-9-]{3,10}$/i) plate!: string;
  @ApiProperty({ type: CustomerDto }) @ValidateNested() @Type(() => CustomerDto) customer!: CustomerDto;
  @ApiProperty({ type: VehicleDto }) @ValidateNested() @Type(() => VehicleDto) vehicle!: VehicleDto;
  @ApiProperty() @IsString() @IsNotEmpty() initialComplaint!: string;
}

export class WorkOrderResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() vehicleId!: string;
  @ApiProperty() customerId!: string;
  @ApiProperty() status!: string;
  @ApiProperty() initialComplaint!: string;
  @ApiProperty() createdAt!: Date;
}

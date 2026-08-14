import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class QueryVehicleStatusDto {
  @IsString() @Matches(/^[A-Z0-9-]{3,10}$/i) plate!: string;
  @IsString() @IsNotEmpty() identification!: string;
}

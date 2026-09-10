import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

// US-19 (BE-10, BE-25): payload to conclude a repair and release its bay.
// finalMileage and closingNotes are optional and are persisted in the
// immutable technical history (RN-19). No monetary fields (RN-16).
export class CompleteWorkOrderDto {
  @ApiPropertyOptional({ description: 'Final odometer mileage in km', minimum: 0, maximum: 1000000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000000)
  finalMileage?: number;

  @ApiPropertyOptional({ description: 'Mechanic closing / quality-control notes' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  closingNotes?: string;
}
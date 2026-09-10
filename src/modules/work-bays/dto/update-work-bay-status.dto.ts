import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

// US-18: physical occupation toggling. Freeing (false) releases the bay and
// disconnects the active work order. Occupying (true) requires the bay to
// already reference a work order; use the assign endpoint otherwise.
export class UpdateWorkBayStatusDto {
  @ApiProperty() @IsBoolean() isOccupied!: boolean;
}
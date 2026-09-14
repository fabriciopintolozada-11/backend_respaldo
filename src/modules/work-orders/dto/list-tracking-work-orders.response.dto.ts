import { ApiProperty } from '@nestjs/swagger';
import { WorkOrderTrackingResponseDto } from './work-order-tracking.response.dto';

// BE-E13 / BE-24: paginated envelope for the tracking summary (US-05). The
// summary previously returned a flat array with no total, which the frontend
// could not page or know the final count of.
export class ListTrackingWorkOrdersResponseDto {
  @ApiProperty({ type: [WorkOrderTrackingResponseDto] })
  data!: WorkOrderTrackingResponseDto[];

  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
}
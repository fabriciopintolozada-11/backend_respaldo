import { ApiProperty } from '@nestjs/swagger';
import { AssignedWorkOrderResponseDto } from './assigned-work-order.response.dto';

// BE-24: every list endpoint responds with { data, total, page, pageSize }.
export class ListAssignedWorkOrdersResponseDto {
  @ApiProperty({ type: [AssignedWorkOrderResponseDto], description: 'Page of assigned work orders' })
  data!: AssignedWorkOrderResponseDto[];

  @ApiProperty({ description: 'Total number of assigned work orders' })
  total!: number;

  @ApiProperty({ description: 'Current page number' })
  page!: number;

  @ApiProperty({ description: 'Number of items per page' })
  pageSize!: number;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { WorkOrderStatus } from '../../../common/enums/work-order-status.enum';

// US-05 (RN-05): status vocabulary of the work-order state machine. The same
// list is used as an allowlist for the tracking filter so queries are explicit.
export const WORK_ORDER_STATUSES = [
  WorkOrderStatus.RECEIVED,
  WorkOrderStatus.ASSIGNED,
  WorkOrderStatus.IN_DIAGNOSIS,
  WorkOrderStatus.QUOTE_SENT,
  WorkOrderStatus.APPROVED,
  WorkOrderStatus.IN_REPAIR,
  WorkOrderStatus.WAITING_FOR_PART,
  WorkOrderStatus.READY_FOR_DELIVERY,
  WorkOrderStatus.DELIVERED,
  WorkOrderStatus.FINALIZED,
] as const;

// BE-T05.1: reactively filters the work-order tracking summary by license
// plate, status or physical bay. All filters are optional (BE-22).
export class QueryTrackingWorkOrdersDto {
  @ApiPropertyOptional({ description: 'Vehicle license plate to filter (US-05)' })
  @IsOptional()
  @IsString()
  licensePlate?: string;

  @ApiPropertyOptional({ enum: WORK_ORDER_STATUSES, description: 'Work order status to filter (US-05)' })
  @IsOptional()
  @IsIn(WORK_ORDER_STATUSES)
  status?: string;

  @ApiPropertyOptional({ description: 'Physical bay identifier to filter (US-05)', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  workBayId?: string;

  // BE-T16.3 (US-16 / RN-06): filters in the database to the orders that have
  // been awaiting quote approval for 15+ days. Query strings arrive as
  // 'true'/'false', so the boolean is coerced with @Transform.
  @ApiPropertyOptional({
    default: false,
    description: 'Only return QUOTE_SENT orders waiting approval for 15+ days (US-16 / RN-06)',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  onlyStaleQuotes?: boolean;

  @ApiPropertyOptional({ default: 1, description: 'Page number, 1-based (BE-24)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, maximum: 100, description: 'Number of items per page (BE-24)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

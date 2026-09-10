import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

// US-05 (RN-05): status vocabulary of the work-order state machine. The same
// list is used as an allowlist for the tracking filter so queries are explicit.
export const WORK_ORDER_STATUSES = [
  'RECIBIDO',
  'ASIGNADA',
  'EN_DIAGNOSTICO',
  'PRESUPUESTO_ENVIADO',
  'APROBADO',
  'EN_REPARACION',
  'EN_ESPERA_DE_REPUESTO',
  'LISTO_ENTREGA',
  'ENTREGADO',
  'FINALIZADO',
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
    description: 'Only return PRESUPUESTO_ENVIADO orders waiting approval for 15+ days (US-16 / RN-06)',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  onlyStaleQuotes?: boolean;
}

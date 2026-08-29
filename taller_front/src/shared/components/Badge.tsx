import type { ReactNode } from 'react';
import type { BayStatus, PartRotation, WorkOrderStatus } from '../../types/workshop';
import type { FuelType } from '../types/openapi';

export interface BadgeProps {
  children?: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'amber' | 'slate';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  dot?: boolean;
}

const variantStyles: Record<NonNullable<BadgeProps['variant']>, string> = {
  default: 'bg-[#2D3139] text-[#8E949F] border-[#2D3139]',
  success: 'bg-[#22C55E15] text-[#22C55E] border-[#22C55E30]',
  warning: 'bg-[#F59E0B15] text-[#F59E0B] border-[#F59E0B30]',
  danger: 'bg-[#EF444415] text-[#EF4444] border-[#EF444430]',
  info: 'bg-[#3B82F615] text-[#3B82F6] border-[#3B82F630]',
  purple: 'bg-[#A855F715] text-[#A855F7] border-[#A855F730]',
  amber: 'bg-[#F9731615] text-[#F97316] border-[#F9731630]',
  slate: 'bg-[#1C2028] text-[#8E949F] border-[#2D3139]',
};

const dotStyles: Record<NonNullable<BadgeProps['variant']>, string> = {
  default: 'bg-[#8E949F]',
  success: 'bg-[#22C55E]',
  warning: 'bg-[#F59E0B]',
  danger: 'bg-[#EF4444]',
  info: 'bg-[#3B82F6]',
  purple: 'bg-[#A855F7]',
  amber: 'bg-[#F97316]',
  slate: 'bg-[#8E949F]',
};

const sizeStyles = {
  sm: 'px-2 py-0.5 text-xs font-semibold',
  md: 'px-2.5 py-1 text-xs font-semibold',
  lg: 'px-3.5 py-1.5 text-sm font-semibold',
};

export function Badge({ children, variant = 'default', size = 'md', className = '', dot = false }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border tracking-wide whitespace-nowrap ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotStyles[variant]}`} />}
      {children}
    </span>
  );
}

const WORK_ORDER_CONFIGS: Record<WorkOrderStatus, { label: string; variant: NonNullable<BadgeProps['variant']> }> = {
  REGISTRADA: { label: '1. Registrada', variant: 'slate' },
  EN_DIAGNOSTICO: { label: '2. En Diagnóstico', variant: 'amber' },
  DIAGNOSTICADA: { label: '3. Diagnóstico Completado', variant: 'info' },
  PRESUPUESTADA: { label: '4. Presupuestada', variant: 'amber' },
  APROBADA: { label: '5. Aprobada x Cliente', variant: 'success' },
  EN_PROGRESO: { label: '6. En Progreso', variant: 'purple' },
  EN_ESPERA_REPUESTO: { label: '7. Espera Repuesto', variant: 'warning' },
  FINALIZADA: { label: '8. Finalizada / Calidad', variant: 'success' },
  ENTREGADA: { label: '9. Entregada / Cobrada', variant: 'default' },
  CANCELADA: { label: 'Cancelada', variant: 'danger' },
};

export function WorkOrderStatusBadge({ status, size = 'md' }: { status: WorkOrderStatus; size?: BadgeProps['size'] }) {
  const config = WORK_ORDER_CONFIGS[status] ?? { label: status, variant: 'default' as const };
  return (
    <Badge variant={config.variant} size={size} dot>
      {config.label}
    </Badge>
  );
}

const BAY_CONFIGS: Record<BayStatus, { label: string; variant: NonNullable<BadgeProps['variant']> }> = {
  LIBRE: { label: 'Disponible', variant: 'success' },
  OCUPADA: { label: 'Ocupada', variant: 'purple' },
  ESPERA_REPUESTO: { label: 'En Pausa x Repuesto', variant: 'warning' },
  MANTENIMIENTO: { label: 'Mantenimiento', variant: 'slate' },
};

export function BayStatusBadge({ status, size = 'md' }: { status: BayStatus; size?: BadgeProps['size'] }) {
  const config = BAY_CONFIGS[status] ?? { label: status, variant: 'default' as const };
  return (
    <Badge variant={config.variant} size={size} dot>
      {config.label}
    </Badge>
  );
}

export function RotationBadge({ rotation }: { rotation: PartRotation }) {
  const configs: Record<PartRotation, { label: string; variant: NonNullable<BadgeProps['variant']> }> = {
    ALTA: { label: 'Alta Rotación', variant: 'success' },
    MEDIA: { label: 'Media Rotación', variant: 'info' },
    BAJA: { label: 'Baja Rotación', variant: 'slate' },
    SIN_ROTACION_ALERTA: { label: '⚠️ Alerta: 2+ Meses Sin Rotar (RN-10)', variant: 'danger' },
  };
  const config = configs[rotation] ?? { label: rotation, variant: 'default' as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export function FuelTypeBadge({ fuel }: { fuel: FuelType }) {
  const configs: Record<FuelType, { label: string; variant: NonNullable<BadgeProps['variant']> }> = {
    GASOLINA: { label: 'Gasolina', variant: 'slate' },
    DIESEL: { label: 'Diésel', variant: 'amber' },
    HIBRIDO: { label: 'Híbrido', variant: 'success' },
    ELECTRICO: { label: '100% Eléctrico (No admitido)', variant: 'danger' },
  };
  const config = configs[fuel] ?? { label: fuel, variant: 'default' as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
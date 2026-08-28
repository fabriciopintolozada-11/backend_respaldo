import type { ReactNode } from 'react';
import { Card } from './Card';

export interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  variant?: 'default' | 'accent' | 'warning' | 'danger';
  className?: string;
}

export function MetricCard({ title, value, subtitle, icon, variant = 'default', className = '' }: MetricCardProps) {
  return (
    <Card variant={variant} className={`relative overflow-hidden ${className}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-semibold text-[#8E949F] uppercase tracking-wider">{title}</p>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-mono">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-[#8E949F] font-medium">{subtitle}</p>}
        </div>
        <div className="p-3 rounded-xl bg-[#F9731615] text-[#F97316] border border-[#F9731630]">{icon}</div>
      </div>
    </Card>
  );
}
import type { ReactNode } from 'react';
import { PackageOpen } from 'lucide-react';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({ icon, title, description, actionLabel, onAction, className = '' }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl border border-dashed border-[#2D3139] bg-[#16191F]/40 ${className}`}
    >
      <div className="w-14 h-14 rounded-2xl bg-[#F9731615] border border-[#F9731630] text-[#F97316] flex items-center justify-center mb-4">
        {icon ?? <PackageOpen className="w-7 h-7" />}
      </div>
      <h3 className="text-base font-bold text-white">{title}</h3>
      <p className="mt-1 text-sm text-[#8E949F] max-w-sm">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 px-3 py-2 text-xs font-bold rounded-xl border border-[#2D3139] bg-[#1C2028] text-[#E0E2E6] hover:bg-[#2D3139] hover:text-white transition-all min-h-[38px]"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
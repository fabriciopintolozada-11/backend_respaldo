import type { HTMLAttributes } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'flat' | 'bordered' | 'accent' | 'warning' | 'danger' | 'success';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingStyles = {
  none: 'p-0',
  sm: 'p-3 sm:p-4',
  md: 'p-4 sm:p-5',
  lg: 'p-5 sm:p-6',
};

const variantStyles = {
  default: 'bg-[#16191F] border border-[#2D3139] rounded-2xl shadow-xs transition-all text-[#E0E2E6]',
  flat: 'bg-[#1C2028] border border-[#2D3139] rounded-xl text-[#E0E2E6]',
  bordered: 'bg-[#16191F] border-2 border-[#2D3139] rounded-2xl text-[#E0E2E6]',
  accent: 'bg-[#16191F] border border-[#F97316]/50 shadow-xs shadow-orange-950/20 rounded-2xl text-[#E0E2E6]',
  warning: 'bg-[#F59E0B10] border border-[#F59E0B30] rounded-2xl text-[#E0E2E6]',
  danger: 'bg-[#EF444410] border border-[#EF444430] rounded-2xl text-[#E0E2E6]',
  success: 'bg-[#22C55E10] border border-[#22C55E30] rounded-2xl text-[#E0E2E6]',
};

export function Card({ children, variant = 'default', padding = 'md', className = '', ...props }: CardProps) {
  return (
    <div className={`${variantStyles[variant]} ${paddingStyles[padding]} ${className}`} {...props}>
      {children}
    </div>
  );
}
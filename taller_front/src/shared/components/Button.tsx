import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'outline' | 'ghost' | 'warning';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles =
    'inline-flex items-center justify-center font-bold rounded-xl transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98] min-h-[44px] min-w-[44px]';

  const sizeStyles = {
    sm: 'px-3 py-2 text-xs gap-1.5 min-h-[38px]',
    md: 'px-4 py-2.5 text-sm gap-2 min-h-[44px]',
    lg: 'px-6 py-3.5 text-base gap-2.5 min-h-[50px]',
  };

  const variantStyles = {
    primary:
      'bg-[#F97316] hover:bg-[#EA580C] text-white shadow-xs shadow-orange-950/40 focus:ring-[#F97316] active:bg-[#C2410C]',
    secondary: 'bg-[#2D3139] text-[#E0E2E6] hover:bg-[#3D4149] hover:text-white focus:ring-[#2D3139]',
    outline:
      'border border-[#2D3139] bg-[#1C2028] text-[#E0E2E6] hover:bg-[#2D3139] hover:text-white focus:ring-[#F97316]',
    danger: 'bg-[#EF4444] text-white hover:bg-[#DC2626] focus:ring-[#EF4444]',
    success: 'bg-[#22C55E] text-white hover:bg-[#16A34A] focus:ring-[#22C55E]',
    warning: 'bg-[#F59E0B15] text-[#F59E0B] border border-[#F59E0B30] hover:bg-[#F59E0B25] focus:ring-[#F59E0B]',
    ghost: 'text-[#8E949F] hover:text-[#E0E2E6] hover:bg-[#2D3139] focus:ring-[#2D3139]',
  };

  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Cargando...</span>
        </>
      ) : (
        <>
          {leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
          <span>{children}</span>
          {rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
        </>
      )}
    </button>
  );
}
import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  id?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, icon, leftIcon, rightIcon, id, className = '', ...props }, ref) => {
    const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);
    const leadingIcon = icon ?? leftIcon;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold uppercase tracking-wider text-[#8E949F] mb-1.5"
          >
            {label}
            {props.required && <span className="text-[#EF4444] ml-1">*</span>}
          </label>
        )}
        <div className="relative rounded-xl shadow-xs">
          {leadingIcon && (
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8E949F]">
              {leadingIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={`block w-full rounded-xl border min-h-[44px] px-3.5 py-2.5 text-sm text-[#E0E2E6] bg-[#0F1115] transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-[#F97316] focus:border-[#F97316] placeholder:text-[#8E949F]/60 ${
              leadingIcon ? 'pl-11' : ''
            } ${rightIcon ? 'pr-11' : ''} ${
              error
                ? 'border-[#EF4444] focus:ring-[#EF4444] focus:border-[#EF4444] bg-[#EF444410]'
                : 'border-[#2D3139] hover:border-[#3D4149]'
            } ${className}`}
            {...props}
          />
          {rightIcon && (
            <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#8E949F]">
              {rightIcon}
            </div>
          )}
        </div>
        {error && <p className="mt-1 text-xs font-medium text-[#EF4444]">{error}</p>}
        {!error && helperText && (
          <p className="mt-1 text-xs text-[#8E949F]">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

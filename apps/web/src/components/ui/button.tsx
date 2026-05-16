import { forwardRef, isValidElement, cloneElement } from 'react';
import { cn } from '@/lib/cn';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost';
  asChild?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', asChild = false, children, ...props }, ref) => {
    const variants = {
      primary: 'bg-ink text-white hover:bg-slate-800 shadow-glow',
      secondary: 'bg-white text-ink border border-slate-200 hover:bg-slate-50',
      ghost: 'bg-transparent text-ink hover:bg-slate-100'
    } as const;

    const buttonClassName = cn(
      'inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60',
      variants[variant],
      className
    );

    if (asChild && isValidElement(children)) {
      const child = children as React.ReactElement<{ className?: string }>;
      return cloneElement(child, {
        className: cn(buttonClassName, child.props.className)
      });
    }

    return (
      <button
        ref={ref}
        className={buttonClassName}
        type={props.type ?? 'button'}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

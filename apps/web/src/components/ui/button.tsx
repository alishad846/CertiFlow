import { forwardRef, isValidElement, cloneElement } from 'react';
import { cn } from '@/lib/cn';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'bronze';
  asChild?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', asChild = false, children, ...props }, ref) => {
    const variants = {
      primary:
        'bg-ink text-paper-bright hover:bg-royal shadow-[0_18px_40px_-20px_rgba(11,27,58,0.8)] hover:-translate-y-0.5',
      secondary:
        'bg-paper-bright text-ink border border-[color:var(--color-border)] hover:border-bronze hover:text-bronze-deep',
      ghost: 'bg-transparent text-ink hover:bg-paper-dim',
      bronze:
        'bg-bronze text-paper-bright hover:bg-bronze-deep shadow-[0_18px_40px_-20px_rgba(148,112,63,0.75)] hover:-translate-y-0.5'
    } as const;

    const buttonClassName = cn(
      'inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-medium tracking-wide transition-all duration-300 ease-out disabled:cursor-not-allowed disabled:opacity-60',
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
      <button ref={ref} className={buttonClassName} type={props.type ?? 'button'} {...props}>
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

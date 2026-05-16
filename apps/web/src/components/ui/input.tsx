import { forwardRef } from 'react';
import { cn } from '@/lib/cn';

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={cn(
        'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-accent-400 focus:ring-4 focus:ring-accent-100',
        className
      )}
      {...props}
    />
  );
});

Input.displayName = 'Input';

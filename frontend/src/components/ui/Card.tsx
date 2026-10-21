import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-2xl border border-charcoal-800/[0.07] bg-white shadow-card', className)} {...props} />;
}

export function CardHeader({ title, description, action, className }: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3 border-b border-charcoal-800/[0.06] px-5 py-4 sm:px-6', className)}>
      <div>
        <h2 className="font-sans text-base font-semibold text-charcoal-900">{title}</h2>
        {description ? <p className="mt-0.5 text-sm text-charcoal-500">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Stat({ label, value, hint, className }: { label: string; value: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <Card className={cn('px-5 py-4', className)}>
      <p className="text-sm text-charcoal-500">{label}</p>
      <p className="mt-1 font-display text-2xl text-charcoal-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-charcoal-500">{hint}</p> : null}
    </Card>
  );
}

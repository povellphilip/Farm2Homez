import { AlertTriangle, CheckCircle2, Info, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { errorMessage } from '@/api/errors';
import { cn } from '@/lib/cn';
import { Button } from './Button';

export function Spinner({ label = 'Loading', className }: { label?: string; className?: string }) {
  return (
    <span role="status" className={cn('inline-flex items-center gap-2 text-sm text-charcoal-500', className)}>
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-sage-300 border-t-forest-700" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function PageLoader() {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <Spinner label="Loading page" />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-sage-100', className)} aria-hidden="true" />;
}

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center rounded-2xl border border-dashed border-sage-300 bg-white/60 px-6 py-14 text-center', className)}>
      {icon ? <div className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-sage-100 text-forest-700">{icon}</div> : null}
      <h2 className="font-display text-xl">{title}</h2>
      {description ? <p className="mt-2 max-w-md text-sm leading-6 text-charcoal-500">{description}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ error, onRetry, title = 'We could not load this' }: { error: unknown; onRetry?: () => void; title?: string }) {
  return (
    <div role="alert" className="rounded-2xl border border-terracotta-100 bg-terracotta-50 px-6 py-10 text-center">
      <AlertTriangle className="mx-auto h-6 w-6 text-terracotta-600" aria-hidden="true" />
      <h2 className="mt-3 font-display text-lg">{title}</h2>
      <p className="mt-1 text-sm text-charcoal-600">{errorMessage(error)}</p>
      {onRetry ? (
        <Button variant="secondary" size="sm" className="mt-5" onClick={onRetry} icon={<RefreshCw className="h-4 w-4" aria-hidden="true" />}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

type Tone = 'info' | 'success' | 'warning' | 'error';

const tones: Record<Tone, { box: string; icon: ReactNode }> = {
  info: { box: 'border-sage-200 bg-sage-50 text-charcoal-700', icon: <Info className="h-5 w-5 text-forest-600" aria-hidden="true" /> },
  success: { box: 'border-forest-100 bg-forest-50 text-forest-800', icon: <CheckCircle2 className="h-5 w-5 text-forest-600" aria-hidden="true" /> },
  warning: { box: 'border-terracotta-100 bg-ivory-100 text-charcoal-800', icon: <AlertTriangle className="h-5 w-5 text-terracotta-500" aria-hidden="true" /> },
  error: { box: 'border-terracotta-100 bg-terracotta-50 text-terracotta-700', icon: <AlertTriangle className="h-5 w-5 text-terracotta-600" aria-hidden="true" /> },
};

export function Alert({ tone = 'info', title, children, className }: { tone?: Tone; title?: string; children?: ReactNode; className?: string }) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('flex gap-3 rounded-xl border px-4 py-3 text-sm leading-6', tones[tone].box, className)}>
      <span className="mt-0.5 shrink-0">{tones[tone].icon}</span>
      <div>
        {title ? <p className="font-semibold">{title}</p> : null}
        {children}
      </div>
    </div>
  );
}

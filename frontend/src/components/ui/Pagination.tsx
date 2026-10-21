import { ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react';
import { Button } from './Button';

export function Pagination({ page, count, pageSize = 20, onChange }: { page: number; count: number; pageSize?: number; onChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  if (pages <= 1) return null;
  return (
    <nav className="mt-8 flex items-center justify-between gap-4" aria-label="Pagination">
      <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)} icon={<ChevronLeft className="h-4 w-4" aria-hidden="true" />}>
        Previous
      </Button>
      <p className="text-sm text-charcoal-500">
        Page {page} of {pages}
      </p>
      <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>
        Next
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </nav>
  );
}

interface StepperProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  label: string;
  disabled?: boolean;
}

export function QuantityStepper({ value, min = 1, max = 9999, onChange, label, disabled }: StepperProps) {
  const clamp = (next: number) => Math.min(max, Math.max(min, next));
  return (
    <div className="inline-flex h-11 items-center rounded-full border border-charcoal-800/15 bg-white" role="group" aria-label={label}>
      <button
        type="button"
        className="grid h-11 w-11 place-items-center rounded-full text-charcoal-700 hover:bg-ivory-100 disabled:opacity-40"
        onClick={() => onChange(clamp(value - 1))}
        disabled={disabled || value <= min}
        aria-label="Decrease quantity"
      >
        <Minus className="h-4 w-4" aria-hidden="true" />
      </button>
      <input
        type="number"
        inputMode="numeric"
        className="h-full w-12 bg-transparent text-center text-sm font-medium tabular-nums [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none"
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next) && next > 0) onChange(clamp(Math.round(next)));
        }}
      />
      <button
        type="button"
        className="grid h-11 w-11 place-items-center rounded-full text-charcoal-700 hover:bg-ivory-100 disabled:opacity-40"
        onClick={() => onChange(clamp(value + 1))}
        disabled={disabled || value >= max}
        aria-label="Increase quantity"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

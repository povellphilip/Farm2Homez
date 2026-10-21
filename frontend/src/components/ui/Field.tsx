import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

const control =
  'block w-full rounded-xl border bg-white px-3.5 text-[15px] text-charcoal-900 placeholder:text-charcoal-400 transition-colors focus:border-forest-600 focus:outline-none focus:ring-2 focus:ring-forest-600/20 disabled:bg-ivory-100 disabled:text-charcoal-500';

interface Wrapper {
  label: string;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
  className?: string;
}

function FieldShell({ id, label, error, hint, optional, className, children }: Wrapper & { id: string; children: ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 flex items-baseline justify-between text-sm font-medium text-charcoal-800">
        <span>{label}</span>
        {optional ? <span className="text-xs font-normal text-charcoal-400">Optional</span> : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-terracotta-700" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-charcoal-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, error?: string, hint?: ReactNode) {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

type InputProps = Wrapper & InputHTMLAttributes<HTMLInputElement>;

export const TextField = forwardRef<HTMLInputElement, InputProps>(function TextField(
  { label, error, hint, optional, className, id, ...props },
  ref,
) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <FieldShell id={fieldId} label={label} error={error} hint={hint} optional={optional} className={className}>
      <input
        ref={ref}
        id={fieldId}
        className={cn(control, 'h-11', error ? 'border-terracotta-500' : 'border-charcoal-800/15')}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, error, hint)}
        {...props}
      />
    </FieldShell>
  );
});

type TextAreaProps = Wrapper & TextareaHTMLAttributes<HTMLTextAreaElement>;

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { label, error, hint, optional, className, id, rows = 4, ...props },
  ref,
) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <FieldShell id={fieldId} label={label} error={error} hint={hint} optional={optional} className={className}>
      <textarea
        ref={ref}
        id={fieldId}
        rows={rows}
        className={cn(control, 'py-2.5 leading-6', error ? 'border-terracotta-500' : 'border-charcoal-800/15')}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, error, hint)}
        {...props}
      />
    </FieldShell>
  );
});

type SelectProps = Wrapper & SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[]; placeholder?: string };

export const SelectField = forwardRef<HTMLSelectElement, SelectProps>(function SelectField(
  { label, error, hint, optional, className, id, options, placeholder, ...props },
  ref,
) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <FieldShell id={fieldId} label={label} error={error} hint={hint} optional={optional} className={className}>
      <select
        ref={ref}
        id={fieldId}
        className={cn(control, 'h-11 pr-9', error ? 'border-terracotta-500' : 'border-charcoal-800/15')}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, error, hint)}
        {...props}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
});

type CheckboxProps = InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; description?: ReactNode };

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox({ label, description, className, id, ...props }, ref) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <div className={cn('flex gap-3', className)}>
      <input
        ref={ref}
        id={fieldId}
        type="checkbox"
        className="mt-0.5 h-[18px] w-[18px] shrink-0 rounded border-charcoal-800/25 accent-forest-700"
        aria-describedby={description ? `${fieldId}-description` : undefined}
        {...props}
      />
      <div className="text-sm">
        <label htmlFor={fieldId} className="font-medium text-charcoal-800">
          {label}
        </label>
        {description ? (
          <p id={`${fieldId}-description`} className="mt-0.5 text-charcoal-500">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
});

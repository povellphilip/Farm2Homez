export function Textarea({ label, error, id, className = '', wrapperClassName = '', ...props }) {
  return (
    <label className={`block ${wrapperClassName}`} htmlFor={id}>
      <span className="mb-2 block text-sm font-medium text-ink">{label}</span>
      <textarea
        id={id}
        className={`min-h-32 w-full resize-y rounded-md border bg-white px-3 py-3 text-sm text-ink transition placeholder:text-slate-400 ${
          error ? 'border-red-400' : 'border-line focus:border-accent'
        } ${className}`}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
      {error ? (
        <span id={`${id}-error`} className="mt-2 block text-sm text-red-600">
          {error}
        </span>
      ) : null}
    </label>
  );
}

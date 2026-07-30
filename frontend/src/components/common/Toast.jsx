import { CheckCircle, XCircle } from 'lucide-react';

export function Toast({ type = 'success', message }) {
  if (!message) return null;
  const Icon = type === 'error' ? XCircle : CheckCircle;

  return (
    <div
      className={`flex items-start gap-3 rounded-md border px-4 py-3 text-sm ${
        type === 'error'
          ? 'border-red-200 bg-red-50 text-red-800'
          : 'border-emerald-200 bg-emerald-50 text-emerald-800'
      }`}
      role="status"
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

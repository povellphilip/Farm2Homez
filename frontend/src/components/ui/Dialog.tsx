import { X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Button } from './Button';
import { TextArea } from './Field';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
}

/** Modal built on the native <dialog> element: focus trapping, Escape and inertness come from the browser. */
export function Dialog({ open, onClose, title, description, children, footer }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal?.();
    if (!open && dialog.open) dialog.close?.();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className="w-[min(32rem,calc(100vw-2rem))] rounded-2xl bg-white p-0 text-charcoal-800 shadow-lift backdrop:bg-charcoal-900/40 backdrop:backdrop-blur-[2px]"
    >
      {open ? (
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <h2 id={titleId} className="text-xl">
              {title}
            </h2>
            <button type="button" onClick={onClose} className="-m-1 rounded-full p-1 text-charcoal-500 hover:bg-ivory-100" aria-label="Close">
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          {description ? <div className="mt-2 text-sm leading-6 text-charcoal-600">{description}</div> : null}
          {children ? <div className="mt-5">{children}</div> : null}
          {footer ? <div className="mt-6 flex flex-wrap justify-end gap-3">{footer}</div> : null}
        </div>
      ) : null}
    </dialog>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  tone?: 'danger' | 'primary';
  /** When set, the user must type a reason (e.g. rejecting an order). */
  reasonLabel?: string;
  reasonRequired?: boolean;
  loading?: boolean;
  error?: string | null;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  tone = 'primary',
  reasonLabel,
  reasonRequired = false,
  loading,
  error,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setReason('');
      setTouched(false);
    }
  }, [open]);

  const missing = reasonRequired && !reason.trim();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Keep it
          </Button>
          <Button
            variant={tone === 'danger' ? 'accent' : 'primary'}
            loading={loading}
            onClick={() => {
              setTouched(true);
              if (!missing) onConfirm(reason.trim());
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {reasonLabel ? (
        <TextArea
          label={reasonLabel}
          rows={3}
          value={reason}
          optional={!reasonRequired}
          onChange={(event) => setReason(event.target.value)}
          error={touched && missing ? 'Please add a short reason.' : undefined}
        />
      ) : null}
      {error ? <p className="mt-3 text-sm text-terracotta-700" role="alert">{error}</p> : null}
    </Dialog>
  );
}

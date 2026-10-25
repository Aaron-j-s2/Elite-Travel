import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import type { BookingStatus } from '../lib/types';
import { STATUS_LABEL } from '../lib/format';
import { Spinner, cx } from '../components/ui/primitives';

/* -------------------------------------------------------------------------- */
/* Session                                                                     */
/* -------------------------------------------------------------------------- */
export interface Admin {
  id: string;
  email: string;
  name: string;
}
export interface AdminFeatures {
  email: boolean;
  supabaseStorage: boolean;
}

export const AdminContext = createContext<{ admin: Admin; features: AdminFeatures; signOut: () => Promise<void> } | null>(null);
export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin outside AdminContext');
  return ctx;
}

/* -------------------------------------------------------------------------- */
/* Toasts                                                                      */
/* -------------------------------------------------------------------------- */
interface Toast {
  id: number;
  tone: 'success' | 'error';
  text: string;
}
const ToastContext = createContext<(text: string, tone?: Toast['tone']) => void>(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Toast['tone'] = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, tone, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 7000 : 4000);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end lg:pr-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className={cx('pointer-events-auto flex max-w-md items-start gap-2.5 rounded-xl px-4 py-3 text-sm font-medium shadow-xl', t.tone === 'error' ? 'bg-danger text-ivory' : 'bg-ink text-ivory')}
          >
            {t.tone === 'error' ? <AlertTriangle className="mt-0.5 size-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-plate" />}
            <span className="flex-1">{t.text}</span>
            <button type="button" onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))} aria-label="Dismiss" className="opacity-70 hover:opacity-100">
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/* -------------------------------------------------------------------------- */
/* Confirm dialog (for destructive / significant actions)                      */
/* -------------------------------------------------------------------------- */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  tone = 'default',
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  tone?: 'default' | 'danger';
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open && !ref.current?.open) ref.current?.showModal();
    if (!open && ref.current?.open) ref.current.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} className="m-auto w-[min(92vw,30rem)] rounded-2xl bg-ivory p-0 text-ink shadow-2xl backdrop:bg-ink/50 backdrop:backdrop-blur-sm" aria-labelledby="confirm-title">
      <div className="p-6">
        <h2 id="confirm-title" className="text-lg font-bold">
          {title}
        </h2>
        <div className="mt-3 text-sm text-ink/75">{children}</div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="btn btn-ghost btn-sm" disabled={busy}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={busy} className={cx('btn btn-sm', tone === 'danger' ? 'bg-danger text-ivory hover:bg-danger/90' : 'btn-primary')}>
            {busy && <Spinner />} {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Small building blocks                                                       */
/* -------------------------------------------------------------------------- */
const STATUS_STYLE: Record<BookingStatus, string> = {
  pending: 'bg-plate/30 text-[#6b4f00] ring-plate',
  confirmed: 'bg-success/10 text-success ring-success/30',
  completed: 'bg-navy/10 text-navy ring-navy/25',
  rejected: 'bg-danger/10 text-danger ring-danger/25',
  cancelled: 'bg-ink/[0.06] text-ink/60 ring-ink/15',
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ring-inset', STATUS_STYLE[status])}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="headline text-4xl lg:text-5xl">{title}</h1>
        {description && <p className="mt-2 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('min-w-0 rounded-2xl border border-line bg-ivory', className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          {title && <h2 className="text-sm font-bold">{title}</h2>}
          {actions}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-stone px-6 py-14 text-center">
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-2 text-sm text-muted">{children}</div>}
    </div>
  );
}

export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border border-danger/30 bg-danger/[0.05] px-6 py-10 text-center">
      <p className="font-semibold text-danger">{message}</p>
      <button type="button" onClick={onRetry} className="btn btn-ghost btn-sm mt-4">
        Try again
      </button>
    </div>
  );
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-line bg-paper px-4 py-3">
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-muted">{description}</span>}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
        <span className="h-6 w-11 rounded-full bg-stone transition peer-checked:bg-navy peer-focus-visible:ring-2 peer-focus-visible:ring-signal" />
        <span className="absolute top-0.5 left-0.5 size-5 rounded-full bg-ivory shadow transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

/** Loads data with abort-on-unmount, exposing loading/error/reload. */
export function useLoad<T>(fn: (signal: AbortSignal) => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    fn(ctrl.signal)
      .then((d) => setData(d))
      .catch((err) => {
        if (err?.name !== 'AbortError') setError(err?.message ?? 'Could not load data.');
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);
  return { data, setData, error, loading, reload: () => setNonce((n) => n + 1) };
}

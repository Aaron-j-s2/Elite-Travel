import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { pickSrc, srcSet } from '../../lib/media';
import type { ImageSet } from '../../lib/types';

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

/* -------------------------------------------------------------------------- */
/* Responsive image                                                           */
/* -------------------------------------------------------------------------- */
export function Img({
  img,
  sizes,
  className,
  priority = false,
  alt,
  style,
}: {
  img: Pick<ImageSet, 'base' | 'widths' | 'width' | 'height' | 'alt'>;
  sizes: string;
  className?: string;
  priority?: boolean;
  alt?: string;
  style?: React.CSSProperties;
}) {
  return (
    <img
      src={pickSrc(img, 960)}
      srcSet={srcSet(img)}
      sizes={sizes}
      width={img.width}
      height={img.height}
      alt={alt ?? img.alt}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      className={className}
      style={style}
    />
  );
}

/** True when a photo is taller than it is wide. */
export const isPortrait = (img: Pick<ImageSet, 'width' | 'height'>) => img.height > img.width;

/**
 * Shows the whole photograph inside a fixed frame (set the frame's aspect ratio with `className`),
 * so no part of the vehicle is ever cropped. Any spare space is filled with a soft, blurred copy of
 * the same photo rather than empty bars.
 */
export function FitImage({
  img,
  sizes,
  className,
  priority = false,
  imgClassName,
}: {
  img: Pick<ImageSet, 'base' | 'widths' | 'width' | 'height' | 'alt'>;
  sizes: string;
  className?: string;
  priority?: boolean;
  imgClassName?: string;
}) {
  return (
    <div className={cx('relative isolate overflow-hidden bg-ink', className)}>
      <img
        src={pickSrc(img, 480)}
        alt=""
        aria-hidden="true"
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        className="absolute inset-0 -z-10 size-full scale-150 object-cover blur-xl saturate-150"
      />
      <span aria-hidden="true" className="absolute inset-0 -z-10 bg-ink/25" />
      <Img img={img} sizes={sizes} priority={priority} className={cx('size-full object-contain', imgClassName)} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Brand                                                                       */
/* -------------------------------------------------------------------------- */
/** Wordmark after the windscreen livery: expanded italic ELITE beside the red-and-blue stripe. */
export function Logo({ light = false, className }: { light?: boolean; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-2.5 leading-none', className)}>
      <span aria-hidden="true" className="stripe !w-5" />
      <span className="flex flex-col gap-[3px]">
        <span className={cx('display text-[1.35rem] !tracking-[-0.02em] italic', light ? 'text-ivory' : 'text-navy')}>Elite</span>
        <span className={cx('font-mono text-[0.5rem] font-bold tracking-[0.42em]', light ? 'text-ivory/65' : 'text-ink/55')}>TRAVEL&nbsp;HUB</span>
      </span>
    </span>
  );
}

export function WhatsAppIcon({ className = 'size-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.23 8.23 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.22-8.23 8.22Zm4.51-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.15.16-.29.18-.54.06-.25-.13-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.43.13-.15.17-.25.25-.42.08-.16.04-.31-.02-.43-.06-.13-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.1-.22-.16-.47-.28Z" />
    </svg>
  );
}

/** Section marker: livery stripe, index number and label — “▰ 02 / The fleet”. */
export function SectionMark({ n, label, light = false, className }: { n: string; label: string; light?: boolean; className?: string }) {
  return (
    <p className={cx('eyebrow flex items-center gap-3', light ? 'text-ivory/60' : 'text-muted', className)}>
      <span aria-hidden="true" className="stripe !w-6" />
      <span className={light ? 'text-ivory' : 'text-ink'}>{n}</span>
      <span aria-hidden="true">/</span>
      <span>{label}</span>
    </p>
  );
}

export function Spinner({ className = 'size-4' }: { className?: string }) {
  return <Loader2 className={cx('animate-spin', className)} aria-hidden="true" />;
}

/* -------------------------------------------------------------------------- */
/* Form fields                                                                 */
/* -------------------------------------------------------------------------- */
interface FieldShellProps {
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  className?: string;
  children: (id: string, describedBy: string | undefined) => ReactNode;
}

export function FieldShell({ label, error, hint, optional, className, children }: FieldShellProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="field-label">
        {label}
        {optional && <span className="ml-1 font-normal text-muted">(optional)</span>}
      </label>
      {children(id, [hintId, errId].filter(Boolean).join(' ') || undefined)}
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-[0.8rem] text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} className="field-error" role="alert">
          <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}

type Base = { label: string; error?: string; hint?: string; optional?: boolean; wrapClassName?: string };

export const TextField = forwardRef<HTMLInputElement, Base & InputHTMLAttributes<HTMLInputElement>>(function TextField(
  { label, error, hint, optional, wrapClassName, className, ...rest },
  ref,
) {
  return (
    <FieldShell label={label} error={error} hint={hint} optional={optional} className={wrapClassName}>
      {(id, describedBy) => (
        <input ref={ref} id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy} className={cx('input', className)} {...rest} />
      )}
    </FieldShell>
  );
});

export const SelectField = forwardRef<HTMLSelectElement, Base & SelectHTMLAttributes<HTMLSelectElement>>(function SelectField(
  { label, error, hint, optional, wrapClassName, className, children, ...rest },
  ref,
) {
  return (
    <FieldShell label={label} error={error} hint={hint} optional={optional} className={wrapClassName}>
      {(id, describedBy) => (
        <select ref={ref} id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy} className={cx('input', className)} {...rest}>
          {children}
        </select>
      )}
    </FieldShell>
  );
});

export const TextAreaField = forwardRef<HTMLTextAreaElement, Base & TextareaHTMLAttributes<HTMLTextAreaElement>>(function TextAreaField(
  { label, error, hint, optional, wrapClassName, className, ...rest },
  ref,
) {
  return (
    <FieldShell label={label} error={error} hint={hint} optional={optional} className={wrapClassName}>
      {(id, describedBy) => (
        <textarea ref={ref} id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy} className={cx('input', className)} {...rest} />
      )}
    </FieldShell>
  );
});

export function FormAlert({ tone = 'error', children }: { tone?: 'error' | 'success' | 'info'; children: ReactNode }) {
  const styles = {
    error: 'border-danger/30 bg-danger/[0.06] text-danger',
    success: 'border-success/30 bg-success/[0.07] text-success',
    info: 'border-signal/30 bg-signal/[0.07] text-ink',
  }[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cx('flex items-start gap-2 rounded-xl border px-4 py-3 text-sm font-medium', styles)}>
      {children}
    </div>
  );
}

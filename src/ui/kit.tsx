import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';
import { subscribeToToasts, dismissToast, Toast } from '../lib/toast';
import { navigate } from './router';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/* ------------------------------------------------------------------ brand */

export function Logo({ className = '', light = false, onClick }: { className?: string; light?: boolean; onClick?: () => void }) {
  return (
    <a
      href="#/"
      onClick={e => {
        if (onClick) {
          e.preventDefault();
          onClick();
        }
      }}
      className={cx('font-script no-underline leading-[1.4]', light ? 'text-cyan' : 'text-ink', className)}
      style={{ fontFamily: 'var(--font-script)' }}
    >
      EzScene
    </a>
  );
}

export function initials(name: string) {
  return name
    .replace(/^(Dr|Engr|Mr|Ms|Mrs|Prof)\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]!.toUpperCase())
    .join('');
}

export function Avatar({ name, size = 40, tone = 'cyan', src }: { name: string; size?: number; tone?: 'cyan' | 'ink'; src?: string }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.38) };
  if (src) return <img src={src} alt="" className="rounded-full object-cover shrink-0" style={style} />;
  return (
    <span
      aria-hidden="true"
      className={cx('inline-flex items-center justify-center rounded-full font-extrabold shrink-0', tone === 'cyan' ? 'bg-cyan text-ink' : 'bg-ink text-cyan')}
      style={style}
    >
      {initials(name)}
    </span>
  );
}

/* ---------------------------------------------------------------- buttons */

type BtnVariant = 'primary' | 'outline' | 'ghost' | 'danger' | 'cyan' | 'success';
const btnBase = 'inline-flex items-center justify-center gap-2 rounded-[6px] font-bold transition-colors disabled:opacity-45 select-none whitespace-nowrap';
const btnVariants: Record<BtnVariant, string> = {
  primary: 'bg-ink text-cyan hover:bg-[#2a2a2a]',
  outline: 'border-2 border-ink text-ink bg-white hover:bg-mist',
  ghost: 'text-ink hover:bg-mist',
  danger: 'border-2 border-bad text-bad bg-white hover:bg-badbg',
  cyan: 'bg-cyan text-ink hover:brightness-95',
  success: 'border-2 border-ok text-ok bg-white hover:bg-okbg'
};
const btnSizes = { sm: 'min-h-9 px-3 text-sm', md: 'min-h-11 px-4 text-[15px]', lg: 'min-h-[54px] px-6 text-lg' };

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  loading,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: keyof typeof btnSizes; loading?: boolean }) {
  return (
    <button {...rest} disabled={rest.disabled || loading} className={cx(btnBase, btnVariants[variant], btnSizes[size], className)}>
      {loading && <span className="spin inline-block w-4 h-4 rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
}

export function LinkButton({ to, variant = 'primary', size = 'md', className, children }: { to: string; variant?: BtnVariant; size?: keyof typeof btnSizes; className?: string; children: React.ReactNode }) {
  return (
    <a href={`#${to}`} className={cx(btnBase, btnVariants[variant], btnSizes[size], 'no-underline', className)}>
      {children}
    </a>
  );
}

export function TextLink({ to, onClick, children, className }: { to?: string; onClick?: () => void; children: React.ReactNode; className?: string }) {
  return (
    <a
      href={to ? `#${to}` : '#'}
      onClick={e => {
        if (onClick) {
          e.preventDefault();
          onClick();
        }
      }}
      className={cx('font-bold text-teal underline underline-offset-2 hover:text-ink', className)}
    >
      {children}
    </a>
  );
}

/* ------------------------------------------------------------------ cards */

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={cx('bg-white border border-line rounded-[14px]', className)}>
      {children}
    </div>
  );
}

type BadgeTone = 'cyan' | 'ok' | 'bad' | 'warn' | 'mist' | 'ink' | 'sky';
const badgeTones: Record<BadgeTone, string> = {
  cyan: 'bg-cyan text-ink',
  ok: 'bg-okbg text-ok',
  bad: 'bg-badbg text-bad',
  warn: 'bg-warnbg text-warn',
  mist: 'bg-mist text-mauve',
  ink: 'bg-ink text-cyan',
  sky: 'bg-sky text-ink'
};
export function Badge({ tone = 'mist', children, className, upper }: { tone?: BadgeTone; children: React.ReactNode; className?: string; upper?: boolean }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-bold whitespace-nowrap', upper && 'uppercase tracking-wide text-[11px]', badgeTones[tone], className)}>
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ forms */

export function Field({ label, htmlFor, hint, error, right, children }: { label?: string; htmlFor?: string; hint?: React.ReactNode; error?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      {(label || right) && (
        <div className="flex items-baseline justify-between gap-2">
          {label && (
            <label htmlFor={htmlFor} className="text-[15px] font-bold">
              {label}
            </label>
          )}
          {right}
        </div>
      )}
      {children}
      {error ? <p className="text-sm font-semibold text-bad">{error}</p> : hint ? <p className="text-sm text-mauve">{hint}</p> : null}
    </div>
  );
}

const inputCls = 'w-full min-h-12 rounded-[8px] border border-line bg-white px-3.5 text-[16px] placeholder:text-[#8a7d83] focus:outline-none focus:border-teal focus:ring-2 focus:ring-cyan/40 read-only:bg-paper read-only:text-mauve';
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...rest }, ref) => (
  <input ref={ref} {...rest} className={cx(inputCls, className)} />
));
export function Select({ className, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={cx(inputCls, 'pr-8', className)}>
      {children}
    </select>
  );
}
export function Textarea({ className, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={cx(inputCls, 'py-2.5 min-h-28 leading-relaxed', className)} />;
}

export function Checkbox({ checked, onChange, label, id }: { checked: boolean; onChange: (v: boolean) => void; label: React.ReactNode; id?: string }) {
  return (
    <label htmlFor={id} className="inline-flex items-center gap-3 cursor-pointer select-none">
      <input id={id} type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="w-5 h-5 accent-ink" />
      <span>{label}</span>
    </label>
  );
}

export function RadioPills({ value, options, onChange, name }: { value: string; options: string[]; onChange: (v: string) => void; name: string }) {
  return (
    <div role="radiogroup" className="flex flex-wrap gap-2">
      {options.map(o => {
        const on = value === o;
        return (
          <label key={o} className={cx('inline-flex items-center gap-2.5 min-h-11 px-3.5 rounded-full border cursor-pointer text-[16px] font-semibold', on ? 'bg-cyan border-ink' : 'bg-white border-line hover:border-mauve')}>
            <input type="radio" name={name} checked={on} onChange={() => onChange(o)} className="w-[18px] h-[18px] accent-ink" />
            {o}
          </label>
        );
      })}
    </div>
  );
}

/** Segmented control (Student / Faculty / Admin). */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex rounded-[10px] bg-blush p-1 gap-1">
      {options.map(o => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx('flex-1 min-h-11 rounded-[7px] text-[16px] font-bold', value === o.value ? 'bg-ink text-cyan' : 'text-ink hover:bg-white/60')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chip({ active, onClick, children, count }: { active?: boolean; onClick?: () => void; children: React.ReactNode; count?: number }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={cx('inline-flex items-center gap-1.5 min-h-10 px-3.5 rounded-full text-[15px] font-bold border', active ? 'bg-ink text-cyan border-ink' : 'bg-white border-line hover:border-mauve')}>
      {children}
      {count !== undefined && <span className={cx('text-xs rounded-full px-1.5', active ? 'bg-cyan text-ink' : 'bg-mist text-mauve')}>{count}</span>}
    </button>
  );
}

/* ----------------------------------------------------------------- dialog */

export function Modal({ open, onClose, title, children, width = 520 }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; width?: number }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/45 p-0 sm:p-6" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className="bg-white w-full rounded-t-[16px] sm:rounded-[16px] max-h-[92vh] overflow-auto shadow-2xl" style={{ maxWidth: width }}>
        <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-3 sticky top-0 bg-white z-10">
          <h2 className="text-xl font-extrabold">{title}</h2>
          <button aria-label="Close" onClick={onClose} className="w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-mist">
            <X size={20} />
          </button>
        </div>
        <div className="px-6 pb-6">{children}</div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- toasts */

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => subscribeToToasts(setItems), []);
  const icon = { success: CheckCircle2, error: XCircle, warning: AlertTriangle, info: Info };
  const color = { success: 'text-ok', error: 'text-bad', warning: 'text-warn', info: 'text-teal' };
  return (
    <div aria-live="polite" className="fixed z-[60] bottom-4 right-4 left-4 sm:left-auto flex flex-col gap-2 items-end pointer-events-none">
      {items.map(t => {
        const Icon = icon[t.type];
        return (
          <div key={t.id} className="toast-in pointer-events-auto w-full sm:w-[380px] bg-white border border-line rounded-[12px] shadow-lg p-3.5 flex gap-3">
            <Icon size={20} className={cx('shrink-0 mt-0.5', color[t.type])} />
            <div className="flex-1 min-w-0">
              <p className="font-bold">{t.title}</p>
              {t.message && <p className="text-sm text-mauve mt-0.5 break-words">{t.message}</p>}
            </div>
            <button aria-label="Dismiss" onClick={() => dismissToast(t.id)} className="text-mauve hover:text-ink">
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- helpers */

export function timeAgo(iso?: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d === 1) return 'Yesterday';
  if (d < 7) return `${d} days ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function clock(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function shortDate(iso?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function isToday(iso?: string) {
  if (!iso) return false;
  return new Date(iso).toDateString() === new Date().toDateString();
}

export function go(path: string) {
  navigate(path);
}

export function EmptyState({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="text-center py-14 px-6">
      <p className="text-lg font-extrabold">{title}</p>
      {children && <p className="text-mauve mt-1.5 max-w-md mx-auto">{children}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function PageTitle({ title, sub, right }: { title: string; sub?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div className="min-w-0">
        <h1 className="text-[34px] sm:text-[40px] leading-[1.1] font-extrabold tracking-[-0.02em]">{title}</h1>
        {sub && <p className="mt-2 text-[17px] text-mauve max-w-3xl">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

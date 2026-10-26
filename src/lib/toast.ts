/**
 * ApplyEase Toast Notification System
 * Framework-free pub/sub so any module (including the store and cloud layer)
 * can raise professional transient alerts without prop drilling.
 */

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  durationMs: number;
}

type ToastListener = (toasts: Toast[]) => void;

const listeners = new Set<ToastListener>();
let toasts: Toast[] = [];

function emit() {
  listeners.forEach(fn => fn([...toasts]));
}

function dismiss(id: string) {
  toasts = toasts.filter(t => t.id !== id);
  emit();
}

export function toast(
  type: ToastType,
  title: string,
  message?: string,
  durationMs = type === 'error' ? 6000 : 3800
) {
  const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  toasts = [...toasts.slice(-4), { id, type, title, message, durationMs }];
  emit();
  if (durationMs > 0) {
    setTimeout(() => dismiss(id), durationMs);
  }
  return id;
}

export function dismissToast(id: string) {
  dismiss(id);
}

export function subscribeToToasts(listener: ToastListener): () => void {
  listeners.add(listener);
  listener([...toasts]);
  return () => {
    listeners.delete(listener);
  };
}

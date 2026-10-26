import { useEffect, useState } from 'react';

/**
 * Minimal hash router. Works on any static host; when the page runs inside a
 * sandboxed frame where history/hash changes are restricted, it keeps the
 * current route in memory instead.
 */
let memoryPath: string | null = null;
const EVENT = 'ezscene:route';

function fromHash(h: string): string {
  const legacy = /^#verify=(.+)$/.exec(h);
  if (legacy) return `/verify/${legacy[1]}`;
  const p = h.replace(/^#/, '');
  return p.startsWith('/') ? p : '/';
}

export function currentPath(): string {
  if (memoryPath !== null) return memoryPath;
  return typeof window !== 'undefined' ? fromHash(window.location.hash) : '/';
}

export function navigate(path: string, replace = false) {
  memoryPath = path;
  try {
    if (replace) window.history.replaceState(null, '', `#${path}`);
    else window.history.pushState(null, '', `#${path}`);
  } catch {
    /* sandboxed: memory routing only */
  }
  window.dispatchEvent(new Event(EVENT));
  try {
    window.scrollTo({ top: 0 });
  } catch {
    /* ignore */
  }
}

if (typeof window !== 'undefined') {
  const sync = () => {
    memoryPath = fromHash(window.location.hash);
    window.dispatchEvent(new Event(EVENT));
  };
  window.addEventListener('hashchange', sync);
  window.addEventListener('popstate', sync);
  // Route in-app links through navigate() so they work even where fragment
  // navigation is blocked.
  document.addEventListener('click', e => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const a = (e.target as HTMLElement | null)?.closest?.('a[href^="#/"]') as HTMLAnchorElement | null;
    if (!a) return;
    e.preventDefault();
    navigate(a.getAttribute('href')!.slice(1));
  });
}

export function useRoute(): { path: string; parts: string[]; query: URLSearchParams } {
  const [path, setPath] = useState(currentPath());
  useEffect(() => {
    const on = () => setPath(currentPath());
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  const [pathname, qs = ''] = path.split('?');
  return { path: pathname, parts: pathname.split('/').filter(Boolean).map(decodeURIComponent), query: new URLSearchParams(qs) };
}

/** Query string of the current route (replaces reads of window.location.hash). */
export function routeQuery(): URLSearchParams {
  return new URLSearchParams(currentPath().split('?')[1] || '');
}

/**
 * EzScene deployment settings.
 * Override any of these at build time with VITE_* variables (see .env.example).
 */
const env = (import.meta as any).env || {};

export const UNIVERSITY_NAME: string = (env.VITE_UNIVERSITY_NAME || 'EzScene University').trim();
export const SUPPORT_EMAIL: string = (env.VITE_SUPPORT_EMAIL || 'support@uni.edu.pk').trim();
/** Public base URL printed on PDFs for QR verification. Defaults to the current site. */
export const PUBLIC_URL: string = (env.VITE_PUBLIC_URL || '').trim();

export function verificationUrl(code: string): string {
  const base =
    PUBLIC_URL ||
    (typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : 'https://ezscene.app/');
  return `${base.replace(/#.*$/, '')}#/verify/${encodeURIComponent(code)}`;
}

/** One-click demo sign-in and guided tour on the landing page. Set VITE_DEMO_MODE=false for a real deployment. */
export const DEMO_MODE: boolean = String(env.VITE_DEMO_MODE ?? 'true') !== 'false';
/** Public GitHub repository, shown in the footer and About page. */
export const REPO_URL: string = (env.VITE_REPO_URL || '').trim();
export const LICENSE_NAME = 'MIT License';

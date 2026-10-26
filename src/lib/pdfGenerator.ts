/**
 * Document text helpers shared by the live preview and the PDF renderer.
 */

import { Application } from '../types';

export async function calculateDocumentHash(contentString: string): Promise<string> {
  return sha256Bytes(new TextEncoder().encode(contentString));
}

export async function sha256Bytes(bytes: ArrayBuffer | Uint8Array): Promise<string> {
  const buffer = await crypto.subtle.digest('SHA-256', bytes as ArrayBuffer);
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-11-18" → "18 Nov 2026". */
export function formatDate(value: string | Date | undefined): string {
  if (!value) return '';
  const d = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDateTime(value: string | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  return `${formatDate(d)}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function daySpan(start?: string, end?: string): number {
  if (!start || !end) return 0;
  const a = new Date(`${start}T00:00:00`).getTime();
  const b = new Date(`${end}T00:00:00`).getTime();
  if (isNaN(a) || isNaN(b) || b < a) return 0;
  return Math.round((b - a) / 86400000) + 1;
}

/**
 * Fill {{tokens}} in a template paragraph. Supports {{field|lower}} and
 * {{days}}; ISO dates are printed as "18 Nov 2026". Bold is kept as **…**
 * so the preview and the PDF can both render it.
 */
export function renderDocumentText(templateString: string, application: Pick<Application, 'studentSnapshot' | 'formData' | 'referenceNumber' | 'applicationTypeTitle' | 'submissionDate' | 'updatedAt'>): string {
  const student = application.studentSnapshot;
  const form = application.formData || {};
  const days = daySpan(form.start_date, form.end_date);
  const values: Record<string, string> = {
    student_name: student?.name || '',
    registration_number: student?.registrationNumber || '',
    reg_no: form.reg_no || student?.registrationNumber || '',
    department: student?.department || '',
    student_email: student?.email || '',
    student_phone: student?.phone || '',
    reference_number: application.referenceNumber,
    application_ref: application.referenceNumber,
    application_title: application.applicationTypeTitle,
    submission_date: formatDate(application.submissionDate || new Date()),
    approval_date: formatDate(application.updatedAt || new Date()),
    days: days ? `${days} day${days === 1 ? '' : 's'}` : '—'
  };
  Object.keys(form).forEach(key => {
    const raw = form[key];
    if (raw === undefined || raw === null || typeof raw === 'object') return;
    const str = String(raw);
    values[key] = /^\d{4}-\d{2}-\d{2}$/.test(str) ? formatDate(str) : str;
  });

  return templateString.replace(/\{\{\s*([a-zA-Z0-9_]+)(\|lower)?\s*\}\}/g, (_m, key: string, lower?: string) => {
    const v = values[key];
    if (v === undefined || v === '') return '____';
    return lower ? v.toLowerCase() : v;
  });
}

/** Split "**bold** normal" into segments. */
export function boldSegments(text: string): { text: string; bold: boolean }[] {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map(part => (part.startsWith('**') && part.endsWith('**') ? { text: part.slice(2, -2), bold: true } : { text: part, bold: false }));
}

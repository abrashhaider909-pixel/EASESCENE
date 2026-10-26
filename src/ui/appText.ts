import { Application } from '../types';
import { shortTitle } from '../lib/constants';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function dateRange(start?: string, end?: string): string {
  if (!start || !end) return '';
  const a = new Date(`${start}T00:00:00`);
  const b = new Date(`${end}T00:00:00`);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return '';
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) return `${a.getDate()}–${b.getDate()} ${MON[a.getMonth()]}`;
  return `${a.getDate()} ${MON[a.getMonth()]} – ${b.getDate()} ${MON[b.getMonth()]}`;
}

/** "Leave Request · 18–20 Nov", "NOC · Internship", or the upload's subject. */
export function requestTitle(app: Application, withDates = true): string {
  const f = app.formData || {};
  if (app.source === 'upload') return f.subject || 'Custom upload';
  if (/No Objection/i.test(app.applicationTypeTitle)) return `NOC${f.purpose ? ` · ${f.purpose}` : ''}`;
  const range = withDates ? dateRange(f.start_date, f.end_date) : '';
  return range ? `${app.applicationTypeTitle} · ${range}` : app.applicationTypeTitle;
}

export function typeLabel(app: Application): string {
  if (app.source === 'upload') return 'Custom upload';
  if (/No Objection/i.test(app.applicationTypeTitle)) return `NOC${app.formData?.purpose ? ` · ${app.formData.purpose}` : ''}`;
  return app.applicationTypeTitle;
}

export type Tone = 'cyan' | 'ok' | 'bad' | 'warn' | 'mist' | 'sky';

export function statusOf(app: Application): { label: string; tone: Tone } {
  const stage = app.stageInstances[app.currentStageIndex];
  switch (app.status) {
    case 'draft':
      return { label: 'Draft', tone: 'mist' };
    case 'completed':
      return { label: 'Approved', tone: 'ok' };
    case 'rejected':
      return { label: 'Rejected', tone: 'bad' };
    case 'cancelled':
      return { label: 'Withdrawn', tone: 'mist' };
    case 'awaiting_student_action':
      return { label: 'Changes requested', tone: 'warn' };
    default:
      return { label: stage ? `On ${shortTitle(stage.assignedRole)}’s desk` : 'In progress', tone: 'sky' };
  }
}

/** One-line summary under the title in lists. */
export function subline(app: Application): string {
  const d = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '');
  const today = (iso?: string) => (iso && new Date(iso).toDateString() === new Date().toDateString() ? 'today' : d(iso));
  const f = app.formData || {};
  const range = dateRange(f.start_date, f.end_date);
  switch (app.status) {
    case 'draft':
      return `Last edited ${d(app.updatedAt)}`;
    case 'completed':
      return `Approved ${d(app.updatedAt)} · ready to download`;
    case 'rejected': {
      const r = app.stageInstances.find(s => s.status === 'rejected');
      return `Rejected ${d(r?.completedAt || app.updatedAt)}${r?.decisionNotes ? ` · ${r.decisionNotes}` : ''}`;
    }
    case 'cancelled':
      return `Withdrawn ${d(app.updatedAt)}`;
    case 'awaiting_student_action':
      return 'Update and resend';
    default:
      return `${range ? `${range} · ` : ''}submitted ${today(app.submissionDate)}`;
  }
}

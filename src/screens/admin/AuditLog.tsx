import { useMemo, useRef, useState } from 'react';
import { Download, ShieldCheck, ShieldAlert, Check, X } from 'lucide-react';
import { useStore } from '../../lib/store';
import { AdminShell } from '../../ui/Shell';
import { Badge, Button, Card, Chip, Input, PageTitle, clock } from '../../ui/kit';
import { formatDate, formatDateTime } from '../../lib/pdfGenerator';
import { Application, AuditLog as Log } from '../../types';
import { requestTitle } from '../../ui/appText';
import { downloadBlob } from '../../lib/download';

const GROUPS: Record<string, { label: string; actions: string[] }> = {
  signatures: { label: 'Signatures', actions: ['STAGE_SIGNED', 'DOCUMENT_ISSUED', 'SIGNATURE_UPDATED'] },
  rejections: { label: 'Rejections', actions: ['APPLICATION_REJECTED', 'CORRECTION_REQUESTED', 'APPLICATION_WITHDRAWN'] },
  admin: { label: 'Admin changes', actions: ['ROLE_CHANGED', 'DESIGNATION_ADDED', 'DESIGNATION_UPDATED', 'DESIGNATION_REMOVED', 'DESIGNATION_REASSIGNED', 'TEMPLATE_UPDATED', 'TEMPLATE_CREATED', 'USER_CREATED', 'USER_UPDATED', 'USER_DELETED', 'SLA_CHECK', 'CLOUD_CONNECTED', 'CLOUD_DISCONNECTED'] },
  security: { label: 'Account security', actions: ['DEMO_SIGN_IN', 'USER_LOGIN', 'USER_LOGOUT', 'PASSWORD_RESET', 'PASSWORD_RESET_REQUESTED', 'PASSWORD_CHANGED', 'ACCOUNT_CREATED'] }
};

const LABELS: Record<string, { label: string; tone: 'ok' | 'sky' | 'bad' | 'warn' | 'mist' }> = {
  STAGE_SIGNED: { label: 'Signed', tone: 'ok' },
  DOCUMENT_ISSUED: { label: 'Issued', tone: 'ok' },
  DOCUMENT_VERIFIED: { label: 'Verified', tone: 'ok' },
  SIGNATURE_UPDATED: { label: 'Signature saved', tone: 'ok' },
  APPLICATION_SUBMISSION: { label: 'Submitted', tone: 'sky' },
  CORRECTION_RESUBMITTED: { label: 'Resubmitted', tone: 'sky' },
  REMINDER_SENT: { label: 'Reminder', tone: 'sky' },
  APPLICATION_REJECTED: { label: 'Rejected', tone: 'bad' },
  VERIFICATION_FAILED: { label: 'Verify failed', tone: 'bad' },
  APPLICATION_WITHDRAWN: { label: 'Withdrawn', tone: 'mist' },
  CORRECTION_REQUESTED: { label: 'Changes asked', tone: 'warn' },
  ROLE_CHANGED: { label: 'Role changed', tone: 'warn' },
  DESIGNATION_REASSIGNED: { label: 'Role changed', tone: 'warn' },
  DESIGNATION_ADDED: { label: 'Designation added', tone: 'warn' },
  DESIGNATION_UPDATED: { label: 'Designation edited', tone: 'warn' },
  DESIGNATION_REMOVED: { label: 'Designation removed', tone: 'warn' },
  TEMPLATE_UPDATED: { label: 'Template updated', tone: 'warn' },
  TEMPLATE_CREATED: { label: 'Template created', tone: 'warn' },
  USER_CREATED: { label: 'Account created', tone: 'warn' },
  ACCOUNT_CREATED: { label: 'Account created', tone: 'mist' },
  USER_UPDATED: { label: 'Account edited', tone: 'warn' },
  USER_DELETED: { label: 'Account deleted', tone: 'warn' },
  USER_LOGIN: { label: 'Log in', tone: 'mist' },
  DEMO_SIGN_IN: { label: 'Demo sign-in', tone: 'mist' },
  USER_LOGOUT: { label: 'Log out', tone: 'mist' },
  PASSWORD_RESET: { label: 'Password reset', tone: 'mist' },
  PASSWORD_RESET_REQUESTED: { label: 'Reset code sent', tone: 'mist' },
  PASSWORD_CHANGED: { label: 'Password changed', tone: 'mist' },
  SLA_CHECK: { label: 'Deadline check', tone: 'mist' }
};

function csvEscape(v: string) {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function VerifyResult({ app, query }: { app?: Application | null; query: string }) {
  if (app === undefined) return null;
  if (!app) {
    return (
      <div className="bg-white rounded-[12px] p-4 flex gap-3 items-start" role="status">
        <span className="w-9 h-9 rounded-full bg-bad text-white inline-flex items-center justify-center shrink-0">
          <X size={18} strokeWidth={3} />
        </span>
        <div>
          <p className="font-extrabold text-bad text-[17px]">Not found: {query || 'this file'} doesn’t match any issued document</p>
          <p className="text-mauve">Check the ID printed beside the QR code. A PDF that was edited after signing no longer matches its fingerprint.</p>
        </div>
      </div>
    );
  }
  const issued = app.issuedDocument!;
  const sigs = issued.appliedSignatures.filter(x => x.slotId !== 'student');
  const h = issued.documentHash;
  return (
    <div className="bg-white rounded-[12px] p-4 flex gap-3 items-start" role="status">
      <span className="w-9 h-9 rounded-full bg-ok text-white inline-flex items-center justify-center shrink-0">
        <Check size={18} strokeWidth={3} />
      </span>
      <div className="min-w-0">
        <p className="font-extrabold text-ok text-[17px]">Authentic: {issued.verificationCode} matches its record</p>
        <p className="text-[15px]">
          {requestTitle(app, false)} for {app.studentSnapshot.name} ({app.studentSnapshot.registrationNumber}) · {sigs.length} signature{sigs.length === 1 ? '' : 's'}: {sigs.map(x => x.roleTitle).join(', ')} · completed {formatDateTime(issued.generatedAt)} · SHA-256 {h.slice(0, 4)}…{h.slice(-4)}
        </p>
      </div>
    </div>
  );
}

export function useVerifier() {
  const s = useStore();
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<Application | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const byId = (code: string) => {
    const c = code.trim();
    if (!c) return;
    const found = s.findIssued(c) || null;
    setQuery(c.toUpperCase());
    setResult(found);
    s.recordVerification(c.toUpperCase(), Boolean(found));
  };
  const byFile = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    const found = (await s.verifyPdfBytes(await file.arrayBuffer())) || null;
    setBusy(false);
    setQuery(file.name);
    setResult(found);
    s.recordVerification(found?.referenceNumber || file.name, Boolean(found));
  };
  return { query, result, busy, byId, byFile };
}

export function AuditLog() {
  const s = useStore();
  const [group, setGroup] = useState<'all' | keyof typeof GROUPS>('all');
  const [limit, setLimit] = useState(40);
  const [input, setInput] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const v = useVerifier();
  const chain = useMemo(() => s.verifyAuditChain(), [s.auditLogs]);

  const rows = useMemo(() => (group === 'all' ? s.auditLogs : s.auditLogs.filter(l => GROUPS[group].actions.includes(l.action))), [s.auditLogs, group]);

  const target = (l: Log) => {
    if (l.applicationRef) {
      const app = s.applications.find(a => a.referenceNumber === l.applicationRef);
      return `${l.applicationRef}${app ? ` · ${requestTitle(app, false)}` : ''}`;
    }
    if (GROUPS.security.actions.includes(l.action)) return 'Account security';
    return l.details;
  };

  const exportCsv = () => {
    const header = ['timestamp', 'event', 'actor', 'actor_role', 'details', 'document', 'prev_hash', 'entry_hash'];
    const lines = rows.map(l => [l.timestamp, l.action, l.actorName, l.actorRole, l.details, l.applicationRef || '', l.prevHash || '', l.entryHash || ''].map(x => csvEscape(String(x))).join(','));
    void downloadBlob(new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' }), `ezscene-audit-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <AdminShell active="audit">
      <PageTitle
        title="Audit log & verification"
        sub="Every submission, signature, rejection and admin change is recorded with a timestamp. Entries are append-only and hash-chained, so any tampering breaks the chain."
        right={
          chain.ok ? (
            <Badge tone="ok" className="text-[14px] px-3.5 py-1.5">
              <ShieldCheck size={16} /> Chain intact · checked today {clock(new Date().toISOString())}
            </Badge>
          ) : (
            <Badge tone="bad" className="text-[14px] px-3.5 py-1.5">
              <ShieldAlert size={16} /> Chain broken — review entries
            </Badge>
          )
        }
      />

      <section className="rounded-[16px] bg-sky p-5 sm:p-6" aria-labelledby="verify-h">
        <h2 id="verify-h" className="text-[20px] font-extrabold">
          Verify a document
        </h2>
        <p className="text-[15px] mb-4">Paste the document ID printed on a PDF, or upload the PDF itself to check its fingerprint.</p>
        <form
          className="flex flex-col sm:flex-row gap-2.5"
          onSubmit={e => {
            e.preventDefault();
            v.byId(input);
          }}
        >
          <Input aria-label="Document ID" value={input} onChange={e => setInput(e.target.value)} placeholder="e.g. EZ-2026-0398" className="flex-1" />
          <Button type="submit" size="lg" disabled={!input.trim()}>
            Verify
          </Button>
          <Button type="button" variant="outline" size="lg" loading={v.busy} onClick={() => fileRef.current?.click()}>
            Upload PDF
          </Button>
          <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="sr-only" onChange={e => void v.byFile(e.target.files?.[0])} />
        </form>
        {v.result !== undefined && (
          <div className="mt-4">
            <VerifyResult app={v.result} query={v.query} />
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 mt-8 mb-4">
        <h2 className="text-[22px] font-extrabold">Event log</h2>
        <Button variant="outline" onClick={exportCsv}>
          <Download size={17} /> Export CSV
        </Button>
      </div>
      <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Filter events">
        <Chip active={group === 'all'} onClick={() => setGroup('all')}>All events</Chip>
        {(Object.keys(GROUPS) as (keyof typeof GROUPS)[]).map(k => (
          <Chip key={k} active={group === k} onClick={() => setGroup(k)}>
            {GROUPS[k].label}
          </Chip>
        ))}
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left">
          <thead>
            <tr className="text-[13px] font-extrabold tracking-[0.06em] text-mauve uppercase border-b border-line">
              <th className="px-5 py-4">Time</th>
              <th className="px-3 py-4">Event</th>
              <th className="px-3 py-4">By</th>
              <th className="px-3 py-4">Document / target</th>
              <th className="px-3 py-4">Entry hash</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, limit).map((l, i) => {
              const lab = LABELS[l.action] || { label: l.action.replace(/_/g, ' ').toLowerCase(), tone: 'mist' as const };
              const actor = s.users.find(u => u.id === l.actorId);
              return (
                <tr key={l.id} className={i % 2 ? 'bg-paper' : 'bg-white'} title={l.details}>
                  <td className="px-5 py-3 text-[15px] whitespace-nowrap">
                    {formatDate(l.timestamp)}, {new Date(l.timestamp).toLocaleTimeString('en-GB')}
                  </td>
                  <td className="px-3 py-3">
                    <Badge tone={lab.tone} upper>
                      {lab.label}
                    </Badge>
                  </td>
                  <td className="px-3 py-3">
                    <span className="block font-bold">{l.actorName}</span>
                    <span className="block text-[13px] text-mauve">
                      {l.actorRole === 'student' ? `Student${actor?.registrationNumber ? ` · ${actor.registrationNumber}` : ''}` : l.actorRole === 'admin' ? 'Administrator' : l.actorRole}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-[15px] max-w-[300px]">
                    <span className="line-clamp-2">{target(l)}</span>
                  </td>
                  <td className="px-3 py-3 font-mono text-[13px]">{l.entryHash ? `${l.entryHash.slice(0, 4)}…${l.entryHash.slice(-4)}` : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length > limit && (
          <div className="p-4 text-center border-t border-line">
            <Button variant="outline" onClick={() => setLimit(l => l + 60)}>
              Show more ({rows.length - limit} older)
            </Button>
          </div>
        )}
      </Card>
    </AdminShell>
  );
}

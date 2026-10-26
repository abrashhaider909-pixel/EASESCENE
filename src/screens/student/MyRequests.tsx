import { useState } from 'react';
import { Check, Eye, Download, PencilLine, Trash2 } from 'lucide-react';
import { useStore } from '../../lib/store';
import { TopShell } from '../../ui/Shell';
import { Avatar, Badge, Button, Card, EmptyState, LinkButton, Modal, clock, cx, isToday } from '../../ui/kit';
import { DocumentPreview, OriginalFile, blocksForApplication } from '../../ui/DocumentPreview';
import { requestTitle, statusOf, subline, typeLabel } from '../../ui/appText';
import { formatDate } from '../../lib/pdfGenerator';
import { navigate } from '../../ui/router';
import { toast } from '../../lib/toast';
import { Application, TimelineEvent } from '../../types';

function Progress({ app }: { app: Application }) {
  const steps = [
    { label: 'Submitted', sub: app.submissionDate ? `${formatDate(app.submissionDate).replace(/ \d{4}$/, '')}, ${clock(app.submissionDate)}` : '', state: 'done' as const },
    ...app.stageInstances.map(s => {
      if (s.status === 'completed') return { label: s.assignedRole, sub: `Signed ${clock(s.completedAt)}`, state: 'done' as const };
      if (s.status === 'rejected') return { label: s.assignedRole, sub: 'Rejected', state: 'rejected' as const };
      if (s.status === 'in_progress' && !['cancelled'].includes(app.status)) return { label: s.assignedRole, sub: app.status === 'awaiting_student_action' ? 'Waiting on you' : 'Reviewing now', state: 'current' as const };
      return { label: s.assignedRole, sub: 'Up next', state: 'todo' as const };
    })
  ];
  return (
    <ol className="grid gap-y-4 my-6" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0,1fr))` }} aria-label="Progress">
      {steps.map((st, i) => (
        <li key={i} className="relative min-w-0">
          {i < steps.length - 1 && <span aria-hidden className={cx('absolute top-[15px] left-8 right-0 h-0.5', steps[i + 1].state === 'todo' ? 'border-t-2 border-dashed border-line' : 'bg-ink')} />}
          <span
            className={cx(
              'relative z-10 w-8 h-8 rounded-full inline-flex items-center justify-center',
              st.state === 'done' && 'bg-ink text-cyan',
              st.state === 'current' && 'bg-cyan border-2 border-ink pulse-ring',
              st.state === 'todo' && 'bg-white border-2 border-line',
              st.state === 'rejected' && 'bg-bad text-white'
            )}
          >
            {st.state === 'done' && <Check size={16} strokeWidth={3} />}
            {st.state === 'rejected' && '×'}
          </span>
          <p className={cx('mt-2 font-bold text-[14px] sm:text-[15px] pr-2 leading-tight', st.state === 'todo' && 'text-mauve')}>{st.label}</p>
          <p className={cx('text-[13px] mt-0.5 font-semibold', st.state === 'done' && i > 0 ? 'text-ok' : st.state === 'current' ? 'text-teal' : st.state === 'rejected' ? 'text-bad' : 'text-mauve')}>{st.sub}</p>
        </li>
      ))}
    </ol>
  );
}

function dotFor(t: TimelineEvent['type']) {
  if (t === 'signature' || t === 'issuance') return 'bg-ok';
  if (t === 'rejection' || t === 'withdrawn') return 'bg-bad';
  if (t === 'opened') return 'bg-ink';
  if (t === 'correction_request' || t === 'reminder') return 'bg-warn';
  if (t === 'submission') return 'bg-line';
  return 'bg-cyan ring-2 ring-ink';
}

export function MyRequests({ selectedId }: { selectedId?: string }) {
  const s = useStore();
  const me = s.currentUser;
  const mine = s.applications.filter(a => a.studentId === me.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const selected = mine.find(a => a.id === selectedId) || mine[0];
  const [viewing, setViewing] = useState(false);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);

  if (mine.length === 0) {
    return (
      <TopShell active="requests">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-10 py-9">
          <h1 className="text-[34px] sm:text-[40px] font-extrabold tracking-[-0.02em]">My requests</h1>
          <Card className="mt-6">
            <EmptyState title="No requests yet" action={<LinkButton to="/new">Create application</LinkButton>}>
              Fill a form or upload a document and it will appear here with live tracking.
            </EmptyState>
          </Card>
        </div>
      </TopShell>
    );
  }

  const type = s.applicationTypes.find(t => t.id === selected.applicationTypeId);
  const stage = selected.stageInstances[selected.currentStageIndex];
  const assignee = s.users.find(u => u.id === stage?.assignedStaffId);
  const live = ['pending_signature', 'pending_approval', 'under_verification', 'submitted', 'overdue'].includes(selected.status);
  const remind = s.canRemind(selected);

  return (
    <TopShell active="requests">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-10 py-9">
        <h1 className="text-[34px] sm:text-[40px] font-extrabold tracking-[-0.02em] mb-6">My requests</h1>
        <div className="grid lg:grid-cols-[300px_minmax(0,1fr)] gap-5 items-start">
          <ul className="flex flex-col gap-2.5" aria-label="Your requests">
            {mine.map(a => {
              const st = statusOf(a);
              const on = a.id === selected.id;
              return (
                <li key={a.id}>
                  <a
                    href={a.status === 'draft' ? `#/new/form/${a.applicationTypeId}?draft=${a.id}` : `#/requests/${a.id}`}
                    aria-current={on ? 'true' : undefined}
                    className={cx('block rounded-[12px] px-4 py-3.5 no-underline border-2', on ? 'bg-white border-ink' : 'bg-paper border-line hover:border-mauve')}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="font-bold text-[17px] leading-snug">{requestTitle(a, false)}</span>
                      <Badge tone={st.tone} className="shrink-0">{st.label}</Badge>
                    </span>
                    <span className="block text-[14px] text-mauve mt-1 truncate">{subline(a)}</span>
                  </a>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-col gap-5 min-w-0">
            <Card className="p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-[24px] sm:text-[28px] font-extrabold leading-tight">{requestTitle(selected)}</h2>
                  <p className="text-mauve mt-1">
                    ID {selected.referenceNumber} · submitted {formatDate(selected.submissionDate)}, {clock(selected.submissionDate)}
                  </p>
                </div>
                {live && (
                  <span className="inline-flex items-center gap-1.5 bg-mist rounded-full px-3 py-1 text-sm font-bold shrink-0">
                    <span className="w-2 h-2 rounded-full bg-ok" /> Live
                  </span>
                )}
              </div>

              {live && stage && (
                <div className="mt-5 bg-ink text-white rounded-[12px] p-4 sm:p-5 flex items-center gap-4">
                  <Avatar name={stage.assignedStaffName || '?'} size={52} />
                  <div className="min-w-0">
                    <p className="text-[12px] font-extrabold tracking-[0.1em] text-cyan">RIGHT NOW</p>
                    <p className="text-[20px] font-extrabold">On {stage.assignedStaffName}’s desk</p>
                    <p className="text-white/75 text-[15px]">
                      {stage.assignedRole} · {stage.openedAt ? 'opened' : 'waiting'} since {clock(stage.openedAt || stage.startedAt)} {isToday(stage.openedAt || stage.startedAt) ? 'today' : formatDate(stage.openedAt || stage.startedAt)}
                    </p>
                  </div>
                </div>
              )}
              {selected.status === 'completed' && (
                <div className="mt-5 rounded-[12px] bg-okbg border border-ok/30 p-4 flex flex-wrap items-center gap-4">
                  <span className="w-11 h-11 rounded-full bg-ok text-white inline-flex items-center justify-center">
                    <Check size={22} strokeWidth={3} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[19px] font-extrabold text-ok">Fully approved</p>
                    <p className="text-ok">All {selected.issuedDocument?.appliedSignatures.length} signatures stamped · {formatDate(selected.updatedAt)}</p>
                  </div>
                  <LinkButton to={`/requests/${selected.id}/document`}>
                    <Download size={18} /> Download PDF
                  </LinkButton>
                </div>
              )}
              {selected.status === 'rejected' && (
                <div className="mt-5 rounded-[12px] bg-badbg p-4">
                  <p className="font-extrabold text-bad">Rejected by {selected.stageInstances.find(x => x.status === 'rejected')?.actionTakenBy}</p>
                  <p className="text-bad mt-0.5">Reason: “{selected.stageInstances.find(x => x.status === 'rejected')?.decisionNotes}”</p>
                  <LinkButton to={selected.source === 'upload' ? '/new' : `/new/form/${selected.applicationTypeId}`} variant="outline" size="sm" className="mt-3">
                    Start a new application
                  </LinkButton>
                </div>
              )}
              {selected.status === 'awaiting_student_action' && (
                <div className="mt-5 rounded-[12px] bg-warnbg p-4">
                  <p className="font-extrabold text-warn">{stage?.assignedStaffName} asked for changes</p>
                  <p className="text-warn mt-0.5">“{selected.correctionRequestNote}”</p>
                  {selected.source !== 'upload' && (
                    <LinkButton to={`/new/form/${selected.applicationTypeId}?resubmit=${selected.id}`} size="sm" className="mt-3">
                      <PencilLine size={16} /> Edit &amp; resend
                    </LinkButton>
                  )}
                </div>
              )}
              {selected.status === 'cancelled' && <div className="mt-5 rounded-[12px] bg-mist p-4 font-bold text-mauve">You withdrew this request on {formatDate(selected.updatedAt)}.</div>}

              <Progress app={selected} />

              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={() => setViewing(true)}>
                  <Eye size={18} /> View document
                </Button>
                {live && (
                  <>
                    <Button
                      variant="outline"
                      disabled={!remind.ok}
                      className={!remind.ok ? 'border-line text-mauve' : ''}
                      onClick={() => {
                        const r = s.sendReminder(selected.id);
                        if (r.ok) toast('success', 'Reminder sent', `${stage?.assignedStaffName} has been notified.`);
                        else toast('warning', 'Not yet', r.error);
                      }}
                    >
                      Send reminder
                    </Button>
                    <button onClick={() => setConfirmWithdraw(true)} className="font-bold text-bad min-h-11 px-2">
                      Withdraw request
                    </button>
                  </>
                )}
              </div>
              {live && !remind.ok && <p className="text-sm text-mauve mt-2">{remind.reason}</p>}
            </Card>

            <Card className="p-5 sm:p-6">
              <h2 className="text-[20px] font-extrabold mb-4">Activity</h2>
              <ol className="relative">
                {[...selected.timeline].reverse().map((e, i, arr) => (
                  <li key={e.id} className="relative pl-7 pb-5 last:pb-0">
                    {i < arr.length - 1 && <span aria-hidden className="absolute left-[5px] top-3 bottom-0 w-px bg-line" />}
                    <span aria-hidden className={cx('absolute left-0 top-1.5 w-[11px] h-[11px] rounded-full', dotFor(e.type))} />
                    <p className="font-bold">{e.title.replace(` (${me.name})`, '')}</p>
                    <p className="text-sm text-mauve">
                      {formatDate(e.timestamp)} · {clock(e.timestamp)}
                      {e.description ? ` · ${e.description}` : ''}
                    </p>
                  </li>
                ))}
              </ol>
            </Card>
          </div>
        </div>
      </div>

      <Modal open={viewing} onClose={() => setViewing(false)} title={typeLabel(selected)} width={820}>
        {selected.source === 'upload' && selected.uploadedDocuments[0] && (
          <div className="rounded-[10px] border border-line overflow-hidden mb-4">
            <OriginalFile file={selected.uploadedDocuments[0]} height={460} />
          </div>
        )}
        {type && (
          <div className="rounded-[6px] border border-line overflow-hidden">
            <DocumentPreview doc={selected} template={type.documentTemplate} blocks={blocksForApplication(selected, type, me, s.signatures, s.users)} />
          </div>
        )}
        {selected.source !== 'upload' && selected.uploadedDocuments.length > 0 && (
          <div className="mt-4 rounded-[10px] border border-line overflow-hidden">
            <OriginalFile file={selected.uploadedDocuments[0]} height={360} />
          </div>
        )}
      </Modal>

      <Modal open={confirmWithdraw} onClose={() => setConfirmWithdraw(false)} title="Withdraw this request?">
        <p className="text-mauve">
          {assignee?.name || 'The current signer'} will be told it no longer needs a signature. Signatures already applied stay in the record. You can’t undo this.
        </p>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={() => setConfirmWithdraw(false)}>
            Keep it
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              const r = s.withdrawApplication(selected.id);
              setConfirmWithdraw(false);
              if (r.ok) toast('info', 'Request withdrawn');
              else toast('error', 'Could not withdraw', r.error);
            }}
          >
            <Trash2 size={16} /> Withdraw
          </Button>
        </div>
      </Modal>
    </TopShell>
  );
}

export { navigate };

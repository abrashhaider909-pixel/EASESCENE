import React, { useEffect, useMemo, useState } from 'react';
import { Check, ArrowRight, PenLine, Smartphone, MessageSquareWarning } from 'lucide-react';
import { useStore } from '../../lib/store';
import { isOnDesk, ownSignature } from '../../lib/access';
import { shortTitle } from '../../lib/constants';
import { TopShell } from '../../ui/Shell';
import { Avatar, Badge, Button, Card, Chip, EmptyState, Field, LinkButton, Modal, Textarea, clock, cx, isToday, timeAgo } from '../../ui/kit';
import { DocumentPreview, OriginalFile, blocksForApplication } from '../../ui/DocumentPreview';
import { typeLabel } from '../../ui/appText';
import { navigate } from '../../ui/router';
import { toast } from '../../lib/toast';
import { Application } from '../../types';
import { EzStore } from '../../lib/store';

/** Approve / reject / request changes with consistent feedback. */
export function useDecisions() {
  const s = useStore();
  const [busy, setBusy] = useState(false);
  const run = async (app: Application, action: 'approve' | 'reject' | 'request_correction', notes = '') => {
    if (action === 'approve' && !ownSignature(s.currentUser, s.signatures)) {
      toast('warning', 'Add your signature first', 'It is stamped onto the document when you approve.');
      navigate('/onboarding/signature');
      return false;
    }
    setBusy(true);
    try {
      const updated = await s.processStageDecision({ applicationId: app.id, action, decisionNotes: notes });
      if (action === 'approve') {
        const next = updated.stageInstances[updated.currentStageIndex];
        toast('success', 'Approved & signed', updated.status === 'completed' ? 'Fully approved — the stamped PDF has been issued.' : `Sent on to ${next?.assignedStaffName} (${next?.assignedRole}).`);
      } else if (action === 'reject') toast('info', 'Request rejected', `${app.studentSnapshot.name} has been told why.`);
      else toast('info', 'Changes requested', `${app.studentSnapshot.name} will update and resend.`);
      return true;
    } catch (e: any) {
      toast('error', 'Could not record the decision', e?.message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

export function ReasonDialog({ open, kind, onClose, onSubmit, busy }: { open: boolean; kind: 'reject' | 'request_correction'; onClose: () => void; onSubmit: (reason: string) => void; busy?: boolean }) {
  const [text, setText] = useState('');
  useEffect(() => {
    if (open) setText('');
  }, [open]);
  const quick = kind === 'reject' ? ['Dates clash with exams', 'Supporting document missing', 'Not eligible under current rules'] : ['Attach the supporting document', 'Correct the dates', 'Add more detail to the reason'];
  return (
    <Modal open={open} onClose={onClose} title={kind === 'reject' ? 'Reject this request' : 'Ask for changes'}>
      <Field label={kind === 'reject' ? 'Reason (shown to the student)' : 'What should the student change?'} htmlFor="reason">
        <Textarea id="reason" autoFocus value={text} onChange={e => setText(e.target.value)} />
      </Field>
      <div className="flex flex-wrap gap-2 mt-3">
        {quick.map(q => (
          <button key={q} onClick={() => setText(q)} className="text-sm font-semibold rounded-full bg-mist px-3 py-1.5 hover:bg-line">
            {q}
          </button>
        ))}
      </div>
      <div className="flex justify-end gap-3 mt-6">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button variant={kind === 'reject' ? 'danger' : 'primary'} disabled={!text.trim()} loading={busy} onClick={() => onSubmit(text.trim())}>
          {kind === 'reject' ? 'Reject' : 'Send to student'}
        </Button>
      </div>
    </Modal>
  );
}

export function ChainPills({ app, meId, compact }: { app: Application; meId: string; compact?: boolean }) {
  return (
    <div className={cx('flex flex-wrap items-center', compact ? 'gap-1.5' : 'gap-2')}>
      {app.stageInstances.map((st, i) => {
        const mine = st.assignedStaffId === meId && st.status === 'in_progress';
        return (
          <React.Fragment key={st.stageId}>
            {i > 0 && <ArrowRight size={14} className="text-mauve" />}
            <span
              className={cx(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-bold whitespace-nowrap',
                compact ? 'text-[13px]' : 'text-[14px]',
                st.status === 'completed' ? 'bg-okbg text-ok' : mine ? 'bg-ink text-cyan' : st.status === 'rejected' ? 'bg-badbg text-bad' : 'bg-mist text-mauve'
              )}
            >
              {st.status === 'completed' && <Check size={13} strokeWidth={3} />}
              {mine ? 'You' : compact ? shortTitle(st.assignedRole) : st.assignedRole}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
}

type Tab = 'inbox' | 'signed' | 'rejected';

export function Inbox({ tab, selectedId }: { tab: Tab; selectedId?: string }) {
  const s = useStore();
  const me = s.currentUser;
  const [filter, setFilter] = useState<'all' | 'forms' | 'uploads' | 'oldest'>('all');
  const [dialog, setDialog] = useState<null | 'reject' | 'request_correction'>(null);
  const { busy, run } = useDecisions();

  const list = useMemo(() => {
    let items: Application[];
    if (tab === 'inbox') items = s.applications.filter(a => isOnDesk(me, a));
    else if (tab === 'signed') items = s.applications.filter(a => a.stageInstances.some(st => st.assignedStaffId === me.id && st.status === 'completed'));
    else items = s.applications.filter(a => a.stageInstances.some(st => st.assignedStaffId === me.id && st.status === 'rejected'));
    if (filter === 'forms') items = items.filter(a => a.source !== 'upload');
    if (filter === 'uploads') items = items.filter(a => a.source === 'upload');
    const key = (a: Application) => (tab === 'inbox' ? a.stageInstances[a.currentStageIndex]?.startedAt || a.updatedAt : a.updatedAt);
    return items.sort((a, b) => (filter === 'oldest' ? key(a).localeCompare(key(b)) : key(b).localeCompare(key(a))));
  }, [s.applications, me, tab, filter]);

  const selected = list.find(a => a.id === selectedId) || list[0];
  useEffect(() => {
    if (selected && tab === 'inbox') EzStore.markOpened(selected.id);
  }, [selected?.id, tab]);

  const type = selected ? s.applicationTypes.find(t => t.id === selected.applicationTypeId) : undefined;
  const stage = selected?.stageInstances[selected.currentStageIndex];
  const onMyDesk = selected ? isOnDesk(me, selected) : false;
  const sig = ownSignature(me, s.signatures);
  const basePath = `/${tab}`;

  const heading = { inbox: 'Inbox', signed: 'Signed', rejected: 'Rejected' }[tab];
  const sub =
    tab === 'inbox'
      ? list.length
        ? `${list.length} request${list.length === 1 ? ' is' : 's are'} waiting for your signature`
        : 'Nothing is waiting for you'
      : tab === 'signed'
        ? 'Requests you approved and signed'
        : 'Requests you rejected';

  const pickNext = () => {
    const idx = list.findIndex(a => a.id === selected?.id);
    const next = list[idx + 1] || list[idx - 1];
    navigate(next ? `${basePath}/${next.id}` : basePath, true);
  };

  return (
    <TopShell active={tab}>
      <div className="max-w-[1240px] mx-auto px-4 sm:px-10 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
          <div>
            <h1 className="text-[34px] sm:text-[40px] font-extrabold tracking-[-0.02em]">{heading}</h1>
            <p className="text-[17px] text-mauve">{sub}</p>
          </div>
          {tab === 'inbox' && (
            <LinkButton to="/review" variant="outline">
              <Smartphone size={18} /> Review on phone
            </LinkButton>
          )}
        </div>

        {tab === 'inbox' && !sig && (
          <div className="mb-5 rounded-[12px] bg-warnbg text-warn px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <span className="font-semibold">You haven’t saved a signature yet. It’s needed to approve requests.</span>
            <LinkButton to="/onboarding/signature" size="sm">
              <PenLine size={16} /> Add signature
            </LinkButton>
          </div>
        )}

        <div className="grid lg:grid-cols-[340px_minmax(0,1fr)] gap-5 items-start">
          <div>
            <div className="flex flex-wrap gap-2 mb-3" role="group" aria-label="Filter">
              <Chip active={filter === 'all'} onClick={() => setFilter('all')}>All</Chip>
              <Chip active={filter === 'forms'} onClick={() => setFilter('forms')}>Forms</Chip>
              <Chip active={filter === 'uploads'} onClick={() => setFilter('uploads')}>Uploads</Chip>
              <Chip active={filter === 'oldest'} onClick={() => setFilter('oldest')}>Oldest first</Chip>
            </div>
            <ul className="flex flex-col gap-2.5">
              {list.length === 0 && (
                <Card>
                  <EmptyState title={tab === 'inbox' ? 'All clear' : 'Nothing here yet'}>{tab === 'inbox' ? 'New requests appear here the moment a student sends them.' : ''}</EmptyState>
                </Card>
              )}
              {list.map(a => {
                const on = a.id === selected?.id;
                const st = a.stageInstances[a.currentStageIndex];
                const mine = a.stageInstances.find(x => x.assignedStaffId === me.id);
                return (
                  <li key={a.id}>
                    <a href={`#${basePath}/${a.id}`} aria-current={on ? 'true' : undefined} className={cx('flex gap-3.5 rounded-[12px] px-4 py-3.5 no-underline border-2', on ? 'bg-white border-ink' : 'bg-paper border-line hover:border-mauve')}>
                      <Avatar name={a.studentSnapshot.name} size={42} tone="ink" />
                      <span className="flex-1 min-w-0">
                        <span className="flex justify-between gap-2">
                          <span className="font-bold text-[17px] truncate">{a.studentSnapshot.name}</span>
                          <span className="text-[13px] text-mauve shrink-0">{timeAgo(tab === 'inbox' ? st?.startedAt : mine?.completedAt)}</span>
                        </span>
                        <span className="block text-[15px] text-mauve truncate">{typeLabel(a)}</span>
                        <span className={cx('block text-[13px] font-bold mt-0.5', tab === 'inbox' ? 'text-teal' : tab === 'signed' ? 'text-ok' : 'text-bad')}>
                          {tab === 'inbox' ? 'Waiting on you' : tab === 'signed' ? (a.status === 'completed' ? 'Fully approved' : `Now with ${st?.assignedStaffName?.split(' ').slice(-1)[0] || 'next signer'}`) : 'Rejected by you'}
                        </span>
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>

          {selected && type && (
            <Card className="overflow-hidden">
              <div className="px-5 sm:px-6 py-5 flex flex-wrap items-start justify-between gap-4 border-b border-line">
                <div className="min-w-0">
                  <Badge tone="cyan" className="text-[14px]">{typeLabel(selected)}</Badge>
                  <h2 className="text-[24px] font-extrabold mt-2">{selected.studentSnapshot.name}</h2>
                  <p className="text-mauve">
                    CMS {selected.studentSnapshot.registrationNumber} · {(selected.formData.programme || '').split(', ')[1] || selected.studentSnapshot.department} · submitted {isToday(selected.submissionDate) ? 'today' : new Date(selected.submissionDate!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, {clock(selected.submissionDate)}
                  </p>
                </div>
                <ChainPills app={selected} meId={me.id} compact />
              </div>
              <div className="bg-paper px-4 sm:px-10 py-6 flex flex-col gap-4">
                {selected.source === 'upload' && selected.uploadedDocuments[0] && (
                  <div className="rounded-[6px] overflow-hidden shadow-[0_10px_30px_rgba(60,30,40,0.12)]">
                    <OriginalFile file={selected.uploadedDocuments[0]} height={480} />
                  </div>
                )}
                <div className="max-w-[680px] w-full mx-auto rounded-[4px] overflow-hidden shadow-[0_10px_30px_rgba(60,30,40,0.12)]">
                  <DocumentPreview doc={selected} template={type.documentTemplate} blocks={blocksForApplication(selected, type, me, s.signatures, s.users)} />
                </div>
                {selected.source !== 'upload' && selected.uploadedDocuments.map(d => (
                  <div key={d.id} className="max-w-[680px] w-full mx-auto rounded-[8px] overflow-hidden border border-line">
                    <OriginalFile file={d} height={380} />
                  </div>
                ))}
                {selected.formData.notes && (
                  <p className="max-w-[680px] mx-auto w-full text-[15px]">
                    <strong>Note from student:</strong> {selected.formData.notes}
                  </p>
                )}
              </div>
              {tab === 'inbox' && onMyDesk ? (
                <div className="px-5 sm:px-6 py-4 border-t border-line flex flex-wrap items-center gap-3 justify-between">
                  <p className="font-semibold text-mauve">Your saved signature will be stamped on the {stage?.assignedRole} block.</p>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button onClick={() => setDialog('request_correction')} className="inline-flex items-center gap-1.5 min-h-11 px-2 font-bold text-ink hover:underline">
                      <MessageSquareWarning size={17} /> Ask for changes
                    </button>
                    <Button variant="danger" size="lg" onClick={() => setDialog('reject')} disabled={busy}>
                      Reject
                    </Button>
                    <Button
                      size="lg"
                      loading={busy}
                      onClick={async () => {
                        if (await run(selected, 'approve')) pickNext();
                      }}
                    >
                      <PenLine size={18} /> Approve &amp; sign
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="px-5 sm:px-6 py-4 border-t border-line text-mauve font-semibold">
                  {selected.status === 'completed' ? 'Fully approved — the stamped PDF has been issued to the student.' : selected.status === 'rejected' ? `Rejected: “${selected.stageInstances.find(x => x.status === 'rejected')?.decisionNotes}”` : selected.status === 'cancelled' ? 'Withdrawn by the student.' : `Now with ${stage?.assignedStaffName} (${stage?.assignedRole}).`}
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
      <ReasonDialog
        open={dialog !== null}
        kind={dialog || 'reject'}
        busy={busy}
        onClose={() => setDialog(null)}
        onSubmit={async reason => {
          if (!selected || !dialog) return;
          const ok = await run(selected, dialog, reason);
          setDialog(null);
          if (ok) pickNext();
        }}
      />
    </TopShell>
  );
}

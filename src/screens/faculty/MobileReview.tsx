import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Eye, Paperclip, PenLine, SlidersHorizontal, Check } from 'lucide-react';
import { useStore, EzStore } from '../../lib/store';
import { isOnDesk, ownSignature } from '../../lib/access';
import { Avatar, Badge, Button, LinkButton, Logo, Modal, cx, timeAgo } from '../../ui/kit';
import { DocumentPreview, OriginalFile, blocksForApplication } from '../../ui/DocumentPreview';
import { dateRange, typeLabel } from '../../ui/appText';
import { daySpan } from '../../lib/pdfGenerator';
import { ChainPills, ReasonDialog, useDecisions } from './Inbox';
import { navigate } from '../../ui/router';
import { Application } from '../../types';

function summary(app: Application) {
  const f = app.formData || {};
  const range = dateRange(f.start_date, f.end_date);
  const days = daySpan(f.start_date, f.end_date);
  if (f.leave_type) return `${range} · ${days} day${days === 1 ? '' : 's'} · ${f.leave_type} leave`;
  if (f.purpose) return `${f.purpose}${f.organisation ? ` at ${f.organisation}` : ''}${range ? ` · ${range}` : ''}`;
  if (app.source === 'upload') return f.subject || 'Uploaded document';
  if (f.semester_to_freeze) return `Freeze ${f.semester_to_freeze} · back ${f.expected_return}`;
  if (f.course_code) return `${f.action} ${f.course_code}${f.course_title ? ` — ${f.course_title}` : ''}`;
  return range || app.applicationTypeTitle;
}

function MiniDoc({ app, meId }: { app: Application; meId: string }) {
  return (
    <div className="bg-sky rounded-[12px] h-[176px] flex justify-center pt-3.5 overflow-hidden" aria-hidden>
      <div className="w-[196px] bg-white rounded-t-[4px] p-3.5 flex flex-col gap-1.5">
        <div className="h-1.5 w-[70%] bg-mist rounded" />
        <div className="h-1 w-full bg-mist rounded" />
        <div className="h-1 w-[92%] bg-mist rounded" />
        <div className="h-1 w-[60%] bg-mist rounded" />
        <div className="mt-auto grid grid-cols-2 gap-2 items-end">
          {app.stageInstances.slice(0, 2).map(st => (
            <div key={st.stageId}>
              {st.status === 'completed' && st.signatureAssetUrl ? (
                <img src={st.signatureAssetUrl} alt="" className="h-6 object-contain" />
              ) : (
                <div className={cx('h-7 rounded-[2px] border border-dashed flex items-center justify-center text-[7px] font-extrabold', st.assignedStaffId === meId ? 'border-teal text-teal bg-skylight' : 'border-line text-mauve')}>{st.assignedStaffId === meId ? 'YOU' : ''}</div>
              )}
              <div className="border-t border-ink mt-0.5 text-[7px] font-bold truncate">{st.assignedRole}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function MobileReview() {
  const s = useStore();
  const me = s.currentUser;
  const mode = s.prefs[me.id]?.approvalMode || 'swipe';
  const queue = useMemo(() => s.applications.filter(a => isOnDesk(me, a)).sort((a, b) => (a.stageInstances[a.currentStageIndex]?.startedAt || '').localeCompare(b.stageInstances[b.currentStageIndex]?.startedAt || '')), [s.applications, me]);
  const [index, setIndex] = useState(0);
  const [detail, setDetail] = useState(mode === 'button');
  const [rejecting, setRejecting] = useState(false);
  const [attachment, setAttachment] = useState(false);
  const [drag, setDrag] = useState({ x: 0, active: false, leaving: 0 });
  const start = useRef(0);
  const { busy, run } = useDecisions();
  const myDesignation = s.designations.find(d => d.holderId === me.id);

  useEffect(() => setDetail(mode === 'button'), [mode]);
  const app = queue[Math.min(index, queue.length - 1)];
  useEffect(() => {
    if (app) EzStore.markOpened(app.id);
  }, [app?.id]);

  const type = app ? s.applicationTypes.find(t => t.id === app.applicationTypeId) : undefined;

  const approve = async () => {
    if (!app) return;
    setDrag(d => ({ ...d, leaving: 1 }));
    const ok = await run(app, 'approve');
    setDrag({ x: 0, active: false, leaving: 0 });
    if (!ok) return;
    if (index >= queue.length - 1) setIndex(Math.max(0, queue.length - 2));
  };

  const onUp = () => {
    if (!drag.active) return;
    if (drag.x > 110) void approve();
    else if (drag.x < -110) {
      setDrag({ x: 0, active: false, leaving: 0 });
      setRejecting(true);
    } else setDrag({ x: 0, active: false, leaving: 0 });
  };

  const frame = (children: React.ReactNode, footer?: React.ReactNode) => (
    <div className="min-h-[100dvh] bg-blush flex justify-center">
      <div className="w-full max-w-[440px] flex flex-col min-h-[100dvh]">
        {children}
        {footer}
      </div>
      <ReasonDialog
        open={rejecting}
        kind="reject"
        busy={busy}
        onClose={() => setRejecting(false)}
        onSubmit={async reason => {
          if (!app) return;
          const ok = await run(app, 'reject', reason);
          setRejecting(false);
          if (ok && index >= queue.length - 1) setIndex(Math.max(0, queue.length - 2));
        }}
      />
      {app?.uploadedDocuments[0] && (
        <Modal open={attachment} onClose={() => setAttachment(false)} title="Attachment" width={720}>
          <OriginalFile file={app.uploadedDocuments[0]} height={520} />
        </Modal>
      )}
    </div>
  );

  if (!app || !type) {
    return frame(
      <div className="px-5 pt-5 flex flex-col flex-1">
        <div className="flex items-center justify-between h-11">
          <Logo className="text-[24px]" onClick={() => navigate('/inbox')} />
          <LinkButton to="/inbox" variant="ghost" size="sm">
            Desktop inbox
          </LinkButton>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
          <span className="w-16 h-16 rounded-full bg-ok text-white inline-flex items-center justify-center">
            <Check size={30} strokeWidth={3} />
          </span>
          <h1 className="text-[28px] font-extrabold">All clear</h1>
          <p className="text-mauve">Nothing is waiting for your signature.</p>
          <LinkButton to="/signed" variant="outline" className="mt-2">
            See what you signed
          </LinkButton>
        </div>
      </div>
    );
  }

  /* ----------------------------------------------------- button / detail */
  if (detail) {
    return frame(
      <div className="flex-1 flex flex-col">
        <div className="px-5 pt-5 flex items-center justify-between gap-2">
          <button aria-label="Back" onClick={() => (mode === 'swipe' ? setDetail(false) : navigate('/inbox'))} className="w-11 h-11 -ml-2 inline-flex items-center justify-center rounded-full hover:bg-white/60">
            <ArrowLeft size={22} />
          </button>
          <p className="font-extrabold text-[17px]">
            Request {Math.min(index, queue.length - 1) + 1} of {queue.length}
          </p>
          <button onClick={() => s.setPrefs(me.id, { approvalMode: mode === 'button' ? 'swipe' : 'button' })} className="rounded-full border border-line bg-white px-3 py-1.5 text-[13px] font-bold">
            {mode === 'button' ? 'Button mode' : 'Swipe mode'}
          </button>
        </div>
        <div className="px-5 mt-4 flex items-center gap-3">
          <Avatar name={app.studentSnapshot.name} size={48} tone="ink" />
          <div className="min-w-0">
            <p className="text-[22px] font-extrabold truncate">{app.studentSnapshot.name}</p>
            <p className="text-mauve">
              CMS {app.studentSnapshot.registrationNumber} · {(app.formData.programme || '').split(', ')[1] || app.studentSnapshot.department} · {timeAgo(app.stageInstances[app.currentStageIndex]?.startedAt)}
            </p>
          </div>
        </div>
        <div className="px-5 mt-3 flex flex-wrap items-center gap-2">
          <Badge tone="cyan" className="text-[14px]">{typeLabel(app)}</Badge>
          <ChainPills app={app} meId={me.id} compact />
        </div>
        <div className="px-5 mt-4 flex-1 overflow-auto pb-28">
          <div className="rounded-[6px] overflow-hidden border border-line shadow-sm">
            <DocumentPreview doc={app} template={type.documentTemplate} blocks={blocksForApplication(app, type, me, s.signatures, s.users)} compact showRef={false} />
          </div>
          {app.uploadedDocuments[0] && (
            <button onClick={() => setAttachment(true)} className="mt-3 w-full bg-white border border-line rounded-[12px] px-4 py-3 flex items-center gap-3 text-left">
              <Paperclip size={20} />
              <span className="min-w-0">
                <span className="block font-bold truncate">{app.uploadedDocuments[0].fileName}</span>
                <span className="block text-sm text-mauve">{app.source === 'upload' ? 'Original document' : 'Attachment'} · tap to open</span>
              </span>
            </button>
          )}
        </div>
      </div>,
      <div className="sticky bottom-0 bg-white border-t border-line px-5 py-4 grid grid-cols-[1fr_1.5fr] gap-3">
        <Button variant="danger" size="lg" onClick={() => setRejecting(true)} disabled={busy}>
          Reject
        </Button>
        <Button
          size="lg"
          loading={busy}
          onClick={async () => {
            const ok = await run(app, 'approve');
            if (ok && index >= queue.length - 1) setIndex(Math.max(0, queue.length - 2));
          }}
        >
          <PenLine size={18} /> Approve &amp; sign
        </Button>
      </div>
    );
  }

  /* ------------------------------------------------------------- swipe */
  const rot = drag.x / 18;
  const tx = drag.leaving ? 520 : drag.x;
  const hint = drag.x > 50 ? 'approve' : drag.x < -50 ? 'reject' : null;

  return frame(
    <div className="px-5 pt-5 flex-1 flex flex-col">
      <div className="flex items-center justify-between h-11">
        <Logo className="text-[24px]" onClick={() => navigate('/inbox')} />
        <div className="flex items-center gap-2">
          <span className="bg-ink text-cyan rounded-full px-3 py-1 text-[14px] font-bold">{queue.length} pending</span>
          <a href="#/profile" aria-label="Approval settings" className="w-11 h-11 inline-flex items-center justify-center rounded-full hover:bg-white/60">
            <SlidersHorizontal size={21} />
          </a>
        </div>
      </div>
      <p className="mt-4 text-[13px] font-extrabold tracking-[0.08em] text-mauve uppercase">Swipe mode{myDesignation ? ` · ${myDesignation.title}` : ''}</p>
      <h1 className="text-[28px] font-extrabold">Review requests</h1>

      <div className="relative mt-4 flex-1 min-h-[460px]">
        {queue[index + 1] && <div className="absolute inset-x-3 top-3 bottom-3 bg-white/70 rounded-[18px] border border-line" aria-hidden />}
        <div
          role="group"
          aria-label={`${app.studentSnapshot.name}, ${typeLabel(app)}. Swipe right to approve, left to reject.`}
          onPointerDown={e => {
            if ((e.target as HTMLElement).closest('button')) return;
            start.current = e.clientX;
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            setDrag({ x: 0, active: true, leaving: 0 });
          }}
          onPointerMove={e => drag.active && setDrag(d => ({ ...d, x: e.clientX - start.current }))}
          onPointerUp={onUp}
          onPointerCancel={() => setDrag({ x: 0, active: false, leaving: 0 })}
          className="absolute inset-0 bg-white rounded-[18px] shadow-[0_14px_40px_rgba(60,30,40,0.16)] p-5 flex flex-col touch-pan-y select-none cursor-grab active:cursor-grabbing"
          style={{ transform: `translateX(${tx}px) rotate(${drag.leaving ? 18 : rot}deg)`, transition: drag.active ? 'none' : 'transform .28s ease', opacity: drag.leaving ? 0 : 1 }}
        >
          {hint && (
            <span className={cx('absolute top-6 z-10 border-[3px] rounded-[8px] px-3 py-1 text-[20px] font-extrabold tracking-wider', hint === 'approve' ? 'left-6 border-ok text-ok -rotate-12' : 'right-6 border-bad text-bad rotate-12')}>
              {hint === 'approve' ? 'APPROVE' : 'REJECT'}
            </span>
          )}
          <div className="flex items-center justify-between">
            <Badge tone="cyan" className="text-[14px]">{typeLabel(app)}</Badge>
            <span className="text-[14px] text-mauve">{timeAgo(app.stageInstances[app.currentStageIndex]?.startedAt)}</span>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <Avatar name={app.studentSnapshot.name} size={46} tone="ink" />
            <div className="min-w-0">
              <p className="text-[20px] font-extrabold truncate">{app.studentSnapshot.name}</p>
              <p className="text-mauve">
                CMS {app.studentSnapshot.registrationNumber} · {(app.formData.programme || '').split(', ')[1] || app.studentSnapshot.department}
              </p>
            </div>
          </div>
          <div className="mt-4">
            <MiniDoc app={app} meId={me.id} />
          </div>
          <div className="mt-4">
            <ChainPills app={app} meId={me.id} compact />
          </div>
          <p className="mt-3 text-[17px] font-semibold">{summary(app)}</p>
          <button onClick={() => setDetail(true)} className="mt-auto min-h-12 rounded-[8px] border border-line font-bold inline-flex items-center justify-center gap-2 hover:bg-paper">
            <Eye size={18} /> Read full document
          </button>
        </div>
      </div>
    </div>,
    <div className="px-5 pb-6 pt-4">
      <p className="text-center text-[14px] text-mauve mb-3">Swipe right to approve and stamp · left to reject</p>
      {!ownSignature(me, s.signatures) && <p className="text-center text-[14px] font-bold text-warn mb-3">Add your signature in Profile before approving.</p>}
      <div className="grid grid-cols-2 gap-3">
        <Button variant="danger" size="lg" className="rounded-full" onClick={() => setRejecting(true)} disabled={busy}>
          <ArrowLeft size={18} /> Reject
        </Button>
        <Button variant="success" size="lg" className="rounded-full" onClick={() => void approve()} loading={busy}>
          Approve <ArrowRight size={18} />
        </Button>
      </div>
    </div>
  );
}

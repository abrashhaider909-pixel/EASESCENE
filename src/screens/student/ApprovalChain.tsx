import { useMemo, useState } from 'react';
import { ChevronUp, ChevronDown, X, RotateCcw, Send, ScanLine, Check } from 'lucide-react';
import { useStore } from '../../lib/store';
import { designationsForStudent } from '../../lib/access';
import { getComposition, setComposition } from '../../lib/composer';
import { TopShell } from '../../ui/Shell';
import { Stepper } from './NewApplication';
import { Badge, Button, Card, Checkbox, EmptyState, Field, Input, LinkButton, TextLink, cx, formatBytes } from '../../ui/kit';
import { navigate } from '../../ui/router';
import { toast } from '../../lib/toast';

export function ApprovalChain() {
  const s = useStore();
  const me = s.currentUser;
  const comp = getComposition();
  const [chain, setChain] = useState<string[]>(comp?.chain || comp?.scan?.designationIds || []);
  const [subject, setSubject] = useState<string>(comp?.formData.subject || '');
  const [sending, setSending] = useState(false);
  const options = useMemo(() => designationsForStudent(me, s.designations), [me, s.designations]);
  const type = comp ? s.applicationTypes.find(t => t.id === comp.typeId) : undefined;

  if (!comp || !type) {
    return (
      <TopShell active="new">
        <EmptyState title="Start with a document" action={<LinkButton to="/new">New application</LinkButton>}>
          Pick a form or upload a file first, then choose who signs.
        </EmptyState>
      </TopShell>
    );
  }

  const suggested = comp.scan?.designationIds || [];
  const update = (next: string[]) => {
    setChain(next);
    setComposition({ ...comp, chain: next });
  };
  const move = (i: number, dir: -1 | 1) => {
    const next = chain.slice();
    const j = i + dir;
    [next[i], next[j]] = [next[j], next[i]];
    update(next);
  };
  const toggle = (id: string, on: boolean) => update(on ? [...chain, id] : chain.filter(x => x !== id));
  const allOn = options.length > 0 && options.every(o => chain.includes(o.id));
  const holder = (id?: string) => s.users.find(u => u.id === id)?.name || 'Vacant';
  const upload = comp.source === 'upload' ? comp.uploadedDocuments[0] : undefined;
  const docName = upload ? upload.fileName : `${type.title} — ${me.name}.pdf`;

  const send = async () => {
    if (!chain.length) {
      toast('error', 'Add at least one signer');
      return;
    }
    if (upload && !subject.trim()) {
      toast('error', 'Give your document a subject');
      return;
    }
    setSending(true);
    try {
      const formData = { ...comp.formData, ...(upload ? { subject: subject.trim() } : {}) };
      delete (formData as any).__text;
      const app = await s.createApplication({
        applicationTypeId: comp.typeId,
        formData,
        uploadedDocuments: comp.uploadedDocuments,
        designationIds: chain,
        source: comp.source,
        draftId: comp.draftId,
        scan: { tags: comp.scan?.tags || [], reasons: comp.scan?.reasons || [], suggestedDesignationIds: suggested, edited: chain.join() !== suggested.join() }
      });
      setComposition(null);
      toast('success', 'Request sent', `${app.referenceNumber} is on ${app.stageInstances[0].assignedStaffName}'s desk.`);
      navigate(`/requests/${app.id}`, true);
    } catch (e: any) {
      toast('error', 'Could not send', e?.message);
      setSending(false);
    }
  };

  return (
    <TopShell active="new">
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-8">
        <Stepper step={2} />
        <h1 className="text-[34px] sm:text-[40px] font-extrabold tracking-[-0.02em]">Who needs to sign?</h1>
        <p className="text-[17px] text-mauve mt-1">Smart scan suggested a chain from your document. Reorder, add or remove designations before sending.</p>

        <div className="grid lg:grid-cols-[320px_minmax(0,1fr)] gap-6 mt-7 items-start">
          <div className="flex flex-col gap-4">
            <Card className="p-4 flex items-start gap-3.5">
              <span className="w-12 h-14 shrink-0 rounded-[4px] border border-ink bg-mist inline-flex items-center justify-center text-[11px] font-extrabold">{/\.docx?$/i.test(docName) ? 'DOC' : 'PDF'}</span>
              <div className="flex-1 min-w-0">
                <p className="font-bold leading-snug break-words">{docName}</p>
                <p className="text-sm text-mauve mt-0.5">{upload ? `${formatBytes(upload.fileSize)} · uploaded` : '1 page · filled online'}</p>
              </div>
              <TextLink to={upload ? '/new' : `/new/form/${type.id}${comp.draftId ? `?draft=${comp.draftId}` : ''}`} className="text-[15px] shrink-0">
                {upload ? 'Change' : 'Edit'}
              </TextLink>
            </Card>
            {upload && (
              <Card className="p-4">
                <Field label="Subject" htmlFor="subject" hint="Shown to signers and printed on the approval sheet.">
                  <Input id="subject" value={subject} onChange={e => setSubject(e.target.value)} />
                </Field>
              </Card>
            )}
            <section className="rounded-[14px] bg-sky p-5" aria-labelledby="scan-h">
              <h2 id="scan-h" className="flex items-center gap-3 text-[19px] font-extrabold">
                <span className="w-9 h-9 rounded-[8px] bg-ink text-cyan inline-flex items-center justify-center">
                  <ScanLine size={18} />
                </span>
                Smart scan results
              </h2>
              <p className="text-[13px] font-extrabold tracking-[0.08em] text-teal mt-5">FOUND IN YOUR DOCUMENT</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {(comp.scan?.tags.length ? comp.scan.tags : ['No keywords found']).map(t => (
                  <span key={t} className="bg-white rounded-full px-3 py-1 text-[14px] font-semibold">{t}</span>
                ))}
              </div>
              <p className="text-[13px] font-extrabold tracking-[0.08em] text-teal mt-5">WHY THIS CHAIN</p>
              <ul className="list-disc pl-5 mt-2 text-[15px] space-y-1.5">
                {(comp.scan?.reasons || []).map(r => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              <Button variant="outline" size="sm" className="mt-5" onClick={() => update(suggested)} disabled={chain.join() === suggested.join()}>
                <RotateCcw size={15} /> Reset to suggestion
              </Button>
            </section>
          </div>

          <div className="flex flex-col gap-5">
            <Card className="p-5 sm:p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
                <h2 className="text-[24px] font-extrabold">Approval chain</h2>
                <p className="text-[15px] text-mauve">
                  {chain.length} signer{chain.length === 1 ? '' : 's'} · signed in this order
                </p>
              </div>
              {chain.length === 0 && <p className="rounded-[10px] bg-paper p-5 text-center text-mauve">No signers yet. Tick designations below to add them.</p>}
              <ol className="flex flex-col">
                {chain.map((id, i) => {
                  const d = s.designations.find(x => x.id === id);
                  if (!d) return null;
                  return (
                    <li key={id} className="flex flex-col">
                      {i > 0 && <span aria-hidden className="ml-[27px] w-0.5 h-4 bg-ink" />}
                      <div className="flex items-center gap-3 bg-paper rounded-[10px] px-3 py-3">
                        <span className="w-8 h-8 rounded-full bg-ink text-cyan font-extrabold inline-flex items-center justify-center shrink-0">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-[17px] flex flex-wrap items-center gap-2">
                            {d.title}
                            {d.department !== me.department && d.reach === 'university' && <span className="text-sm font-semibold text-mauve">{d.department}</span>}
                            {suggested.includes(id) && <Badge tone="cyan" upper className="text-[10px]">Suggested</Badge>}
                          </p>
                          <p className="text-mauve text-[15px]">{holder(d.holderId)}</p>
                        </div>
                        <div className="flex items-center">
                          <button aria-label={`Move ${d.title} up`} disabled={i === 0} onClick={() => move(i, -1)} className="w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-white disabled:opacity-30">
                            <ChevronUp size={19} />
                          </button>
                          <button aria-label={`Move ${d.title} down`} disabled={i === chain.length - 1} onClick={() => move(i, 1)} className="w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-white disabled:opacity-30">
                            <ChevronDown size={19} />
                          </button>
                          <button aria-label={`Remove ${d.title}`} onClick={() => toggle(id, false)} className="w-10 h-10 inline-flex items-center justify-center rounded-full text-bad hover:bg-white">
                            <X size={19} />
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </Card>

            <section className="rounded-[14px] bg-sky p-5" aria-labelledby="add-h">
              <h2 id="add-h" className="text-[19px] font-extrabold mb-3">
                Add or remove designations
              </h2>
              <ul className="flex flex-col gap-1.5 max-h-[300px] overflow-auto pr-1">
                {options.map(o => {
                  const on = chain.includes(o.id);
                  return (
                    <li key={o.id}>
                      <label className={cx('flex items-center gap-3 min-h-12 px-3 rounded-[8px] cursor-pointer', on ? 'bg-cyan' : 'bg-white/60 hover:bg-white')}>
                        <input type="checkbox" checked={on} onChange={e => toggle(o.id, e.target.checked)} className="w-5 h-5 accent-ink" />
                        <span className="flex-1 font-bold">
                          {o.title}
                          {o.reach === 'department' ? '' : ''}
                        </span>
                        <span className="text-[15px] text-ink/80 w-[45%] truncate">{holder(o.holderId)}</span>
                        {on && <Check size={16} className="shrink-0" />}
                      </label>
                    </li>
                  );
                })}
              </ul>
              <div className="flex justify-center mt-3">
                <Checkbox
                  id="select-all"
                  checked={allOn}
                  onChange={v => update(v ? Array.from(new Set([...chain, ...options.map(o => o.id)])) : [])}
                  label={<span className="font-bold">Select all</span>}
                />
              </div>
            </section>

            <div className="flex flex-col items-center gap-2.5">
              <Button size="lg" className="w-full max-w-[440px] text-[22px] min-h-[60px]" onClick={send} loading={sending} disabled={!chain.length}>
                Send request <Send size={20} />
              </Button>
              <p className="text-[15px] text-mauve text-center">You’ll get a notification each time someone signs, and can track it under My requests.</p>
            </div>
          </div>
        </div>
      </div>
    </TopShell>
  );
}

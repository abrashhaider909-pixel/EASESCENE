import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Paperclip, X } from 'lucide-react';
import { useStore } from '../../lib/store';
import { ownSignature } from '../../lib/access';
import { suggestForForm } from '../../lib/smartScan';
import { getComposition, setComposition } from '../../lib/composer';
import { daySpan } from '../../lib/pdfGenerator';
import { TopShell } from '../../ui/Shell';
import { DocumentPreview, SigBlock, useDocPreview } from '../../ui/DocumentPreview';
import { Button, Card, Field, Input, RadioPills, Select, Textarea, TextLink, EmptyState, LinkButton, formatBytes, readFileAsDataUrl } from '../../ui/kit';
import { navigate } from '../../ui/router';
import { toast } from '../../lib/toast';
import { FormFieldDefinition, UploadedDocument } from '../../types';

export function FormFill({ typeId, draftId, resubmitId }: { typeId: string; draftId?: string; resubmitId?: string }) {
  const s = useStore();
  const me = s.currentUser;
  const type = s.applicationTypes.find(t => t.id === typeId);
  const draft = draftId ? s.applications.find(a => a.id === draftId && a.studentId === me.id) : undefined;
  const resubmit = resubmitId ? s.applications.find(a => a.id === resubmitId && a.studentId === me.id) : undefined;
  const comp = getComposition();
  const fileRef = useRef<HTMLInputElement>(null);

  const initial = useMemo(() => {
    const base: Record<string, any> = {};
    type?.formConfig.fields.forEach(f => {
      if (f.type === 'profile_autofill' && f.autoFillProfileKey) base[f.id] = (me as any)[f.autoFillProfileKey] || '';
      else if (f.id === 'programme') base[f.id] = me.semester || f.options?.[0] || '';
      else if (f.type === 'select' && f.helpText === 'radio') base[f.id] = f.options?.[0] || '';
      else base[f.id] = f.defaultValue ?? '';
    });
    const prior = resubmit?.formData || draft?.formData || (comp?.typeId === typeId && comp.source === 'form' ? comp.formData : undefined);
    return { ...base, ...(prior || {}) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeId, draftId, resubmitId]);

  const [form, setForm] = useState<Record<string, any>>(initial);
  const [docs, setDocs] = useState<UploadedDocument[]>(resubmit?.uploadedDocuments || draft?.uploadedDocuments || (comp?.typeId === typeId ? comp.uploadedDocuments : []) || []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [savedDraftId, setSavedDraftId] = useState<string | undefined>(draft?.id || comp?.draftId);
  useEffect(() => setForm(initial), [initial]);

  const preview = useDocPreview(type, form, me);

  if (!type) {
    return (
      <TopShell active="new">
        <EmptyState title="This form isn’t available" action={<LinkButton to="/new">Back to forms</LinkButton>}>
          It may have been retired by the admin office.
        </EmptyState>
      </TopShell>
    );
  }

  const chainIds = comp?.typeId === typeId && comp.chain ? comp.chain : suggestForForm(type, form, me, s.designations).designationIds;
  const mySig = ownSignature(me, s.signatures);
  const blocks: SigBlock[] = [
    ...(type.documentTemplate.includeStudentSignature ? [{ key: 'student', label: 'Student', name: me.name, imageUrl: mySig?.imageUrl, state: mySig ? ('signed' as const) : ('pending' as const) }] : []),
    ...chainIds.map(id => {
      const d = s.designations.find(x => x.id === id);
      return { key: id, label: d?.title || '', state: 'pending' as const };
    })
  ];

  const set = (id: string, v: any) => {
    setForm(f => ({ ...f, [id]: v }));
    if (errors[id]) setErrors(e => ({ ...e, [id]: '' }));
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    type.formConfig.fields.forEach(f => {
      const v = form[f.id];
      if (f.required && (v === undefined || v === null || String(v).trim() === '')) errs[f.id] = `${f.label} is required.`;
    });
    if (form.start_date && form.end_date && !daySpan(form.start_date, form.end_date)) errs.end_date = 'The end date must be on or after the start date.';
    setErrors(errs);
    if (Object.keys(errs).length) {
      const first = document.getElementById(`f-${Object.keys(errs)[0]}`);
      first?.focus();
      return false;
    }
    return true;
  };

  const onAttach = async (file?: File) => {
    if (!file) return;
    if (!/\.(pdf|jpe?g|png)$/i.test(file.name)) {
      toast('error', 'Attach a PDF or JPG');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast('error', 'File is too large', 'The limit is 10 MB.');
      return;
    }
    const url = await readFileAsDataUrl(file);
    const req = type.formConfig.requiredDocuments[0];
    setDocs([
      { id: `up-${Date.now()}`, requirementId: req?.id || 'doc-supporting', requirementName: req?.name || 'Supporting document', fileName: file.name, fileDataUrl: url, fileSize: file.size, fileType: file.type || 'application/pdf', uploadedAt: new Date().toISOString(), status: 'pending' }
    ]);
  };

  const saveDraft = () => {
    try {
      const d = s.saveDraft({ draftId: savedDraftId, applicationTypeId: type.id, formData: form, uploadedDocuments: docs });
      setSavedDraftId(d.id);
      toast('success', 'Draft saved', 'Find it under New application or My requests.');
    } catch (e: any) {
      toast('error', 'Could not save draft', e?.message);
    }
  };

  const next = () => {
    if (!validate()) return;
    if (resubmit) {
      s.resubmitCorrection({ applicationId: resubmit.id, updatedFormData: form, replacementDocuments: docs });
      toast('success', 'Changes sent', 'Your request is back on the same desk.');
      navigate(`/requests/${resubmit.id}`);
      return;
    }
    const scan = suggestForForm(type, form, me, s.designations);
    const keepChain = comp?.typeId === typeId && comp.chain && comp.scan?.designationIds.join() === scan.designationIds.join();
    setComposition({ typeId, source: 'form', formData: form, uploadedDocuments: docs, draftId: savedDraftId, scan, chain: keepChain ? comp!.chain : scan.designationIds });
    navigate('/new/chain');
  };

  const fields = type.formConfig.fields;
  const rows: FormFieldDefinition[][] = [];
  for (let i = 0; i < fields.length; i += 1) {
    const f = fields[i];
    const n = fields[i + 1];
    const pairable = (x?: FormFieldDefinition) => x && (x.type === 'profile_autofill' || x.type === 'date' || x.type === 'number');
    if (pairable(f) && pairable(n) && f.type === n!.type) {
      rows.push([f, n!]);
      i += 1;
    } else rows.push([f]);
  }

  const renderField = (f: FormFieldDefinition) => {
    const id = `f-${f.id}`;
    const v = form[f.id] ?? '';
    const err = errors[f.id];
    if (f.type === 'profile_autofill') return <Field key={f.id} label={f.label} htmlFor={id} error={err}><Input id={id} value={v} readOnly aria-readonly /></Field>;
    if (f.type === 'select' && f.helpText === 'radio') return <Field key={f.id} label={f.label} error={err}><RadioPills name={f.id} value={v} options={f.options || []} onChange={x => set(f.id, x)} /></Field>;
    if (f.type === 'select') return <Field key={f.id} label={f.label} htmlFor={id} error={err}><Select id={id} value={v} onChange={e => set(f.id, e.target.value)}><option value="">Select…</option>{(f.options || []).map(o => <option key={o}>{o}</option>)}</Select></Field>;
    if (f.type === 'textarea') return <Field key={f.id} label={f.label} htmlFor={id} error={err}><Textarea id={id} value={v} placeholder={f.placeholder} onChange={e => set(f.id, e.target.value)} /></Field>;
    if (f.type === 'date') return <Field key={f.id} label={f.label} htmlFor={id} error={err}><Input id={id} type="date" value={v} onChange={e => set(f.id, e.target.value)} /></Field>;
    if (f.type === 'number') return <Field key={f.id} label={f.label} htmlFor={id} error={err}><Input id={id} type="number" min={0} value={v} onChange={e => set(f.id, e.target.value)} /></Field>;
    if (f.type === 'checkbox') return <label key={f.id} className="flex items-center gap-3"><input type="checkbox" checked={Boolean(v)} onChange={e => set(f.id, e.target.checked)} className="w-5 h-5 accent-ink" /> {f.label}</label>;
    return <Field key={f.id} label={f.label} htmlFor={id} error={err}><Input id={id} value={v} placeholder={f.placeholder} onChange={e => set(f.id, e.target.value)} /></Field>;
  };

  const autofillCount = fields.filter(f => f.type === 'profile_autofill').length;

  return (
    <TopShell active="new">
      <div className="max-w-[1180px] mx-auto px-4 sm:px-6 py-8">
        <nav aria-label="Breadcrumb" className="text-[15px] text-mauve">
          <TextLink to="/new">New application</TextLink> / {resubmit ? 'Update request' : type.title}
        </nav>
        <h1 className="text-[34px] sm:text-[40px] font-extrabold tracking-[-0.02em] mt-2 mb-6">{type.title}</h1>
        {resubmit?.correctionRequestNote && (
          <div className="mb-5 rounded-[12px] bg-warnbg text-warn px-4 py-3">
            <strong>Changes requested:</strong> “{resubmit.correctionRequestNote}”
          </div>
        )}
        <div className="grid lg:grid-cols-[minmax(0,540px)_minmax(0,1fr)] gap-6 items-start">
          <Card className="p-6">
            <div className="flex flex-col gap-5">
              {rows.map((row, i) => (
                <React.Fragment key={i}>
                  {row.length === 2 ? <div className="grid grid-cols-2 gap-3.5">{row.map(renderField)}</div> : renderField(row[0])}
                  {i === 0 && autofillCount > 0 && row[0].type === 'profile_autofill' && <p className="-mt-3 text-sm text-mauve">Filled from your profile.</p>}
                </React.Fragment>
              ))}
              <div className="rounded-[10px] bg-sky px-4 py-3 flex items-center gap-3">
                <Paperclip size={18} className="shrink-0" />
                <div className="flex-1 min-w-0 text-[15px]">
                  {docs[0] ? (
                    <span className="flex items-center gap-2 min-w-0">
                      <strong className="truncate">{docs[0].fileName}</strong>
                      <span className="text-mauve shrink-0">{formatBytes(docs[0].fileSize)}</span>
                      <button aria-label="Remove attachment" onClick={() => setDocs([])} className="text-mauve hover:text-bad shrink-0">
                        <X size={16} />
                      </button>
                    </span>
                  ) : (
                    <span>
                      <strong>Supporting document</strong> (optional) · PDF or JPG
                    </span>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  {docs[0] ? 'Replace' : 'Attach'}
                </Button>
                <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="sr-only" onChange={e => void onAttach(e.target.files?.[0])} />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                {!resubmit ? (
                  <Button variant="outline" size="lg" onClick={saveDraft}>
                    Save draft
                  </Button>
                ) : (
                  <span />
                )}
                <Button size="lg" onClick={next}>
                  {resubmit ? 'Send changes' : 'Continue to approval chain'} <ArrowRight size={18} />
                </Button>
              </div>
            </div>
          </Card>

          <section aria-label="Document preview" className="lg:sticky lg:top-[88px]">
            <div className="flex items-center justify-between mb-2.5">
              <h2 className="text-[17px] font-extrabold">Document preview</h2>
              <span className="inline-flex items-center gap-1.5 bg-ink text-cyan rounded-full px-2.5 py-0.5 text-[13px] font-bold">
                <span className="w-2 h-2 rounded-full bg-cyan" /> Live
              </span>
            </div>
            <div className="rounded-[6px] shadow-[0_14px_40px_rgba(60,30,40,0.14)] overflow-hidden">
              <DocumentPreview doc={preview} template={type.documentTemplate} blocks={blocks} formLabel={`Form ${type.key.toUpperCase().slice(0, 4)}-${String(type.publishedVersion).padStart(2, '0')} · v${type.publishedVersion}`} />
            </div>
            <p className="text-sm text-mauve mt-3">Signature blocks are fixed by the template, so each authority’s signature lands in exactly the right place.</p>
          </section>
        </div>
      </div>
    </TopShell>
  );
}

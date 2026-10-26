import { useRef, useState } from 'react';
import { Upload, Pencil, Plus, ChevronUp, ChevronDown, X, Download } from 'lucide-react';
import { useStore } from '../../lib/store';
import { CUSTOM_UPLOAD_TYPE_ID, shortTitle, stageFromDesignation } from '../../lib/constants';
import { AdminShell } from '../../ui/Shell';
import { Badge, Button, Card, Checkbox, Field, Input, Modal, PageTitle, Select, Textarea, cx, readFileAsDataUrl } from '../../ui/kit';
import { toast } from '../../lib/toast';
import { downloadDataUrl } from '../../lib/download';
import { formatDate } from '../../lib/pdfGenerator';
import { ApplicationType, FieldType, FormFieldDefinition } from '../../types';

const FIELD_TYPES: { value: FieldType | 'radio'; label: string }[] = [
  { value: 'text', label: 'Short text' },
  { value: 'textarea', label: 'Paragraph' },
  { value: 'date', label: 'Date' },
  { value: 'number', label: 'Number' },
  { value: 'select', label: 'Dropdown' },
  { value: 'radio', label: 'Choice pills' },
  { value: 'profile_autofill', label: 'From profile' }
];

const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30) || `field_${Date.now()}`;

function blankType(title: string, sourceFile?: { name: string; dataUrl: string; size: number }): ApplicationType {
  const id = `type-${Date.now()}`;
  return {
    id,
    key: slug(title).replace(/_/g, '-'),
    title,
    tag: 'New',
    description: '',
    category: 'administrative',
    icon: 'FileText',
    estimatedDurationDays: 2,
    active: true,
    publishedVersion: 1,
    formConfig: {
      version: 1,
      title,
      description: '',
      instructions: '',
      fields: [
        { id: 'student_name', label: 'Full name', type: 'profile_autofill', autoFillProfileKey: 'name', required: true },
        { id: 'reg_no', label: 'CMS ID', type: 'profile_autofill', autoFillProfileKey: 'registrationNumber', required: true },
        { id: 'reason', label: 'Details', type: 'textarea', required: true }
      ],
      requiredDocuments: [{ id: 'doc-supporting', name: 'Supporting document', description: 'PDF or JPG', required: false, acceptedFormats: ['pdf', 'jpg', 'png'], maxSizeMB: 10 }],
      declarations: [],
      feeRules: { required: false, amount: 0 }
    },
    documentTemplate: {
      id: `tpl-${id}`,
      version: 1,
      title: title.toUpperCase(),
      orientation: 'portrait',
      headerNotice: '',
      bodyParagraphs: ['I, **{{student_name}}** (CMS ID {{reg_no}}), request the following:', '{{reason}}'],
      signatureSlots: [],
      stampSlots: [],
      footerNotice: '',
      includeVerificationQR: true,
      includeStudentSignature: true,
      sourceFile
    },
    workflowDefinition: { id: `wf-${id}`, version: 1, stages: [] }
  };
}

function TemplateEditor({ initial, onClose }: { initial: ApplicationType; onClose: () => void }) {
  const s = useStore();
  const isNew = !s.applicationTypes.some(t => t.id === initial.id);
  const [t, setT] = useState<ApplicationType>(initial);
  const [tab, setTab] = useState<'details' | 'fields' | 'document' | 'chain'>('details');
  const fields = t.formConfig.fields;
  const setFields = (next: FormFieldDefinition[]) => setT({ ...t, formConfig: { ...t.formConfig, fields: next } });
  const chainIds = t.workflowDefinition.stages.map(st => st.designationId!).filter(Boolean);
  const setChain = (ids: string[]) =>
    setT({ ...t, workflowDefinition: { ...t.workflowDefinition, stages: ids.map((id, i) => stageFromDesignation(s.designations.find(d => d.id === id)!, i + 1)) } });

  const save = () => {
    if (!t.title.trim()) {
      toast('error', 'Give the template a title');
      setTab('details');
      return;
    }
    if (!chainIds.length) {
      toast('error', 'Add at least one signer to the default chain');
      setTab('chain');
      return;
    }
    const ids = fields.map(f => f.id);
    if (new Set(ids).size !== ids.length) {
      toast('error', 'Two fields share the same ID', 'Rename one of them.');
      setTab('fields');
      return;
    }
    const saved = s.saveApplicationType({ ...t, formConfig: { ...t.formConfig, title: t.title } }, { bumpVersion: !isNew });
    toast('success', isNew ? 'Template created' : `Saved as v${saved.publishedVersion}`, 'Students see the new version immediately; past requests keep theirs.');
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={isNew ? 'New template' : `Edit ${initial.title}`} width={860}>
      <div className="flex flex-wrap gap-2 mb-5" role="tablist">
        {(['details', 'fields', 'document', 'chain'] as const).map(k => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cx('min-h-10 px-4 rounded-full font-bold border', tab === k ? 'bg-ink text-cyan border-ink' : 'bg-white border-line')}>
            {{ details: 'Details', fields: `Fields (${fields.length})`, document: 'Document', chain: `Default chain (${chainIds.length})` }[k]}
          </button>
        ))}
      </div>

      {tab === 'details' && (
        <div className="flex flex-col gap-4">
          <Field label="Title" htmlFor="t-title">
            <Input id="t-title" value={t.title} onChange={e => setT({ ...t, title: e.target.value })} />
          </Field>
          <Field label="Short description" htmlFor="t-desc">
            <Input id="t-desc" value={t.description} onChange={e => setT({ ...t, description: e.target.value })} placeholder="Shown on the form card" />
          </Field>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Card label" htmlFor="t-tag">
              <Input id="t-tag" value={t.tag || ''} onChange={e => setT({ ...t, tag: e.target.value })} placeholder="e.g. Academic" />
            </Field>
            <Field label="Category" htmlFor="t-cat">
              <Select id="t-cat" value={t.category} onChange={e => setT({ ...t, category: e.target.value as ApplicationType['category'] })}>
                <option value="academic">Academic</option>
                <option value="administrative">Administrative</option>
                <option value="hostel">Hostel</option>
                <option value="financial">Financial</option>
              </Select>
            </Field>
          </div>
          <Checkbox id="t-active" checked={t.active} onChange={v => setT({ ...t, active: v })} label="Active — students can fill this form" />
          {t.documentTemplate.sourceFile && (
            <div className="rounded-[10px] bg-paper p-3 flex items-center justify-between gap-3">
              <span className="text-[15px]">
                Source file: <strong>{t.documentTemplate.sourceFile.name}</strong>
              </span>
              <Button variant="outline" size="sm" onClick={() => downloadDataUrl(t.documentTemplate.sourceFile!.dataUrl, t.documentTemplate.sourceFile!.name)}>
                <Download size={15} /> Download
              </Button>
            </div>
          )}
        </div>
      )}

      {tab === 'fields' && (
        <div className="flex flex-col gap-3">
          {fields.map((f, i) => {
            const kind = f.type === 'select' && f.helpText === 'radio' ? 'radio' : f.type;
            return (
              <div key={i} className="rounded-[12px] border border-line p-3.5 bg-paper">
                <div className="grid sm:grid-cols-[1fr_170px_auto] gap-3 items-end">
                  <Field label="Label" htmlFor={`fl-${i}`}>
                    <Input
                      id={`fl-${i}`}
                      value={f.label}
                      onChange={e => {
                        const next = fields.slice();
                        const isFresh = f.id.startsWith('field_');
                        next[i] = { ...f, label: e.target.value, id: isFresh ? slug(e.target.value) : f.id };
                        setFields(next);
                      }}
                    />
                  </Field>
                  <Field label="Type" htmlFor={`ft-${i}`}>
                    <Select
                      id={`ft-${i}`}
                      value={kind}
                      onChange={e => {
                        const v = e.target.value;
                        const next = fields.slice();
                        next[i] = v === 'radio' ? { ...f, type: 'select', helpText: 'radio', options: f.options?.length ? f.options : ['Option 1', 'Option 2'] } : { ...f, type: v as FieldType, helpText: undefined, autoFillProfileKey: v === 'profile_autofill' ? f.autoFillProfileKey || 'name' : undefined, options: v === 'select' ? f.options || ['Option 1'] : f.options };
                        setFields(next);
                      }}
                    >
                      {FIELD_TYPES.map(o => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <div className="flex items-center gap-1 pb-1">
                    <button aria-label="Move up" disabled={i === 0} onClick={() => { const n = fields.slice(); [n[i - 1], n[i]] = [n[i], n[i - 1]]; setFields(n); }} className="w-9 h-9 inline-flex items-center justify-center rounded-full hover:bg-white disabled:opacity-30">
                      <ChevronUp size={17} />
                    </button>
                    <button aria-label="Move down" disabled={i === fields.length - 1} onClick={() => { const n = fields.slice(); [n[i + 1], n[i]] = [n[i], n[i + 1]]; setFields(n); }} className="w-9 h-9 inline-flex items-center justify-center rounded-full hover:bg-white disabled:opacity-30">
                      <ChevronDown size={17} />
                    </button>
                    <button aria-label="Remove field" onClick={() => setFields(fields.filter((_, j) => j !== i))} className="w-9 h-9 inline-flex items-center justify-center rounded-full hover:bg-white text-bad">
                      <X size={17} />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4 mt-3">
                  <span className="text-sm text-mauve">
                    Token: <code className="bg-white px-1.5 py-0.5 rounded">{`{{${f.id}}}`}</code>
                  </span>
                  <Checkbox id={`fr-${i}`} checked={f.required} onChange={v => { const n = fields.slice(); n[i] = { ...f, required: v }; setFields(n); }} label="Required" />
                  {f.type === 'profile_autofill' && (
                    <Select aria-label="Profile value" value={f.autoFillProfileKey} onChange={e => { const n = fields.slice(); n[i] = { ...f, autoFillProfileKey: e.target.value as any }; setFields(n); }} className="w-[200px] min-h-10">
                      <option value="name">Name</option>
                      <option value="registrationNumber">CMS ID</option>
                      <option value="email">Email</option>
                      <option value="department">Department</option>
                      <option value="phone">Phone</option>
                      <option value="hostelRoom">Hostel room</option>
                    </Select>
                  )}
                </div>
                {f.type === 'select' && (
                  <Field label="Options (one per line)" htmlFor={`fo-${i}`}>
                    <Textarea id={`fo-${i}`} className="min-h-20 mt-1" value={(f.options || []).join('\n')} onChange={e => { const n = fields.slice(); n[i] = { ...f, options: e.target.value.split('\n') }; setFields(n); }} onBlur={() => { const n = fields.slice(); n[i] = { ...f, options: (f.options || []).map(o => o.trim()).filter(Boolean) }; setFields(n); }} />
                  </Field>
                )}
              </div>
            );
          })}
          <Button variant="outline" onClick={() => setFields([...fields, { id: `field_${fields.length + 1}`, label: '', type: 'text', required: false }])}>
            <Plus size={17} /> Add field
          </Button>
        </div>
      )}

      {tab === 'document' && (
        <div className="flex flex-col gap-4">
          <Field label="Document heading" htmlFor="doc-title">
            <Input id="doc-title" value={t.documentTemplate.title} onChange={e => setT({ ...t, documentTemplate: { ...t.documentTemplate, title: e.target.value } })} />
          </Field>
          <Field label="Body (one paragraph per line)" htmlFor="doc-body" hint={<>Use field tokens like <code>{'{{reason}}'}</code>, <code>{'{{student_name}}'}</code>, <code>{'{{submission_date}}'}</code>, <code>{'{{days}}'}</code>. Wrap text in **double asterisks** for bold; add <code>|lower</code> for lowercase.</>}>
            <Textarea id="doc-body" className="min-h-48" value={t.documentTemplate.bodyParagraphs.join('\n')} onChange={e => setT({ ...t, documentTemplate: { ...t.documentTemplate, bodyParagraphs: e.target.value.split('\n') } })} onBlur={() => setT({ ...t, documentTemplate: { ...t.documentTemplate, bodyParagraphs: t.documentTemplate.bodyParagraphs.filter(p => p.trim()) } })} />
          </Field>
          <Checkbox id="doc-sig" checked={Boolean(t.documentTemplate.includeStudentSignature)} onChange={v => setT({ ...t, documentTemplate: { ...t.documentTemplate, includeStudentSignature: v } })} label="Include the student’s signature block" />
          <p className="text-sm text-mauve">Signature blocks follow the approval chain in order, so each authority’s signature lands in its own block.</p>
        </div>
      )}

      {tab === 'chain' && (
        <div className="grid sm:grid-cols-2 gap-5">
          <div>
            <p className="font-bold mb-2">Default chain</p>
            <ol className="flex flex-col gap-2">
              {chainIds.length === 0 && <li className="text-mauve">No signers yet.</li>}
              {chainIds.map((id, i) => {
                const d = s.designations.find(x => x.id === id);
                return (
                  <li key={id} className="flex items-center gap-2 bg-paper rounded-[10px] px-3 py-2">
                    <span className="w-7 h-7 rounded-full bg-ink text-cyan text-sm font-extrabold inline-flex items-center justify-center">{i + 1}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-bold truncate">{d?.title}</span>
                      <span className="block text-xs text-mauve truncate">{d?.department}</span>
                    </span>
                    <button aria-label="Move up" disabled={i === 0} onClick={() => { const n = chainIds.slice(); [n[i - 1], n[i]] = [n[i], n[i - 1]]; setChain(n); }} className="w-8 h-8 inline-flex items-center justify-center disabled:opacity-30"><ChevronUp size={16} /></button>
                    <button aria-label="Move down" disabled={i === chainIds.length - 1} onClick={() => { const n = chainIds.slice(); [n[i + 1], n[i]] = [n[i], n[i + 1]]; setChain(n); }} className="w-8 h-8 inline-flex items-center justify-center disabled:opacity-30"><ChevronDown size={16} /></button>
                    <button aria-label="Remove" onClick={() => setChain(chainIds.filter(x => x !== id))} className="w-8 h-8 inline-flex items-center justify-center text-bad"><X size={16} /></button>
                  </li>
                );
              })}
            </ol>
            <p className="text-sm text-mauve mt-3">For department designations, students automatically get their own department’s equivalent.</p>
          </div>
          <div>
            <p className="font-bold mb-2">Add a designation</p>
            <ul className="flex flex-col gap-1.5 max-h-[340px] overflow-auto">
              {s.designations.filter(d => !chainIds.includes(d.id)).map(d => (
                <li key={d.id}>
                  <button onClick={() => setChain([...chainIds, d.id])} className="w-full text-left rounded-[8px] border border-line px-3 py-2 hover:border-ink">
                    <span className="font-bold">{d.title}</span> <span className="text-sm text-mauve">· {d.scope || d.department}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3 mt-7 pt-4 border-t border-line">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={save}>{isNew ? 'Create template' : `Publish v${initial.publishedVersion + 1}`}</Button>
      </div>
    </Modal>
  );
}

function Schematic({ t }: { t: ApplicationType }) {
  const editable = t.formConfig.fields.filter(f => f.type !== 'profile_autofill').length;
  const blocks = t.workflowDefinition.stages.length;
  return (
    <div className="mx-auto w-full max-w-[232px] aspect-[1/1.41] border border-line bg-white p-4 flex flex-col shadow-sm" aria-hidden>
      <div className="h-2.5 bg-ink" />
      <div className="h-2 w-1/2 bg-[#E3CFD5] self-center mt-3" />
      <div className="grid grid-cols-2 gap-1.5 mt-4">
        <div className="h-3 bg-[#B5EAF3]" />
        <div className="h-3 bg-[#B5EAF3]" />
      </div>
      {Array.from({ length: Math.min(2, editable) }).map((_, i) => (
        <div key={i} className="h-3 bg-[#B5EAF3] mt-1.5" />
      ))}
      {editable > 2 && <div className="h-14 bg-[#B5EAF3] mt-1.5" />}
      <div className="mt-auto grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(3, blocks + (t.documentTemplate.includeStudentSignature ? 1 : 0)) || 1}, 1fr)` }}>
        {t.documentTemplate.includeStudentSignature && <div className="h-8 border border-dashed border-ink" />}
        {Array.from({ length: Math.min(t.documentTemplate.includeStudentSignature ? 2 : 3, blocks) }).map((_, i) => (
          <div key={i} className="h-8 border-2 border-dashed border-teal bg-skylight" />
        ))}
      </div>
    </div>
  );
}

export function Templates() {
  const s = useStore();
  const list = s.applicationTypes.filter(t => t.id !== CUSTOM_UPLOAD_TYPE_ID);
  const [selectedId, setSelectedId] = useState(list[0]?.id);
  const [editing, setEditing] = useState<ApplicationType | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const selected = list.find(t => t.id === selectedId) || list[0];
  const chain = (t: ApplicationType) => t.workflowDefinition.stages.map(st => shortTitle(st.assignedRole)).join(' → ') || '—';
  const sigBlocks = (t: ApplicationType) => t.workflowDefinition.stages.length + (t.documentTemplate.includeStudentSignature ? 1 : 0);

  const onUpload = async (file?: File) => {
    if (!file) return;
    if (!/\.(pdf|docx?)$/i.test(file.name)) {
      toast('error', 'Upload a PDF or Word file');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast('error', 'File is too large', 'The limit is 10 MB.');
      return;
    }
    const dataUrl = await readFileAsDataUrl(file);
    const title = file.name.replace(/\.(pdf|docx?)$/i, '').replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    setEditing(blankType(title, { name: file.name, dataUrl, size: file.size }));
  };

  return (
    <AdminShell active="templates">
      <PageTitle title="Document templates" sub="Forms students fill online. Each template carries its fillable fields, default approval chain and fixed signature blocks for precise stamping." />
      <div
        onDragOver={e => e.preventDefault()}
        onDrop={e => {
          e.preventDefault();
          void onUpload(e.dataTransfer.files?.[0]);
        }}
        className="rounded-[14px] border-2 border-dashed border-teal/60 bg-sky px-5 py-4 flex flex-wrap items-center gap-4 mb-5"
      >
        <Upload size={30} className="shrink-0" />
        <div className="flex-1 min-w-[220px]">
          <p className="text-[19px] font-extrabold">Upload a new template</p>
          <p className="text-mauve">Drop a PDF or Word file here, then mark its fillable fields and signature blocks.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditing(blankType('New form'))}>
            <Plus size={17} /> Blank form
          </Button>
          <Button onClick={() => fileRef.current?.click()}>Choose file</Button>
        </div>
        <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" className="sr-only" onChange={e => void onUpload(e.target.files?.[0])} />
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_320px] gap-5 items-start">
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left">
            <thead>
              <tr className="text-[13px] font-extrabold tracking-[0.06em] text-mauve uppercase border-b border-line">
                <th className="px-5 py-4">Template</th>
                <th className="px-2 py-4">Ver.</th>
                <th className="px-2 py-4">Default chain</th>
                <th className="px-2 py-4">Updated</th>
                <th className="px-2 py-4">Status</th>
                <th className="px-2 py-4"><span className="sr-only">Edit</span></th>
              </tr>
            </thead>
            <tbody>
              {list.map(t => (
                <tr key={t.id} onClick={() => setSelectedId(t.id)} className={cx('cursor-pointer border-b border-mist last:border-0', t.id === selected?.id ? 'bg-skylight' : 'hover:bg-paper')}>
                  <td className="px-5 py-3">
                    <button className="text-left" onClick={() => setSelectedId(t.id)}>
                      <span className="block font-bold text-[16px]">{t.title}</span>
                      <span className="block text-[13px] text-mauve">
                        {t.formConfig.fields.length} fields · {sigBlocks(t)} signature block{sigBlocks(t) === 1 ? '' : 's'}
                      </span>
                    </button>
                  </td>
                  <td className="px-2 py-3 font-extrabold">v{t.publishedVersion}</td>
                  <td className="px-2 py-3 text-[14px] max-w-[190px]">{chain(t)}</td>
                  <td className="px-2 py-3 text-[14px] whitespace-nowrap">{formatDate(t.updatedAt || t.documentTemplate.updatedAt)}</td>
                  <td className="px-2 py-3">
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        s.setTypeActive(t.id, !t.active);
                        toast('info', t.active ? `${t.title} retired` : `${t.title} is active`);
                      }}
                      title={t.active ? 'Click to retire' : 'Click to activate'}
                    >
                      <Badge tone={t.active ? 'ok' : 'warn'}>{t.active ? 'Active' : 'Retired'}</Badge>
                    </button>
                  </td>
                  <td className="px-2 py-3">
                    <button
                      aria-label={`Edit ${t.title}`}
                      onClick={e => {
                        e.stopPropagation();
                        setEditing(t);
                      }}
                      className="w-9 h-9 inline-flex items-center justify-center rounded-full hover:bg-white"
                    >
                      <Pencil size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {selected && (
          <Card className="p-5">
            <h2 className="text-[19px] font-extrabold">
              {selected.title} · v{selected.publishedVersion}
            </h2>
            <p className="text-sm text-mauve mb-4">Fields and signature blocks on page 1</p>
            <Schematic t={selected} />
            <ul className="mt-4 flex flex-col gap-1.5 text-[14px]">
              <li className="flex gap-2.5">
                <span className="w-4 h-3 bg-[#B5EAF3] mt-1 shrink-0" />
                {selected.formConfig.fields.length} fillable fields ({selected.formConfig.fields.map(f => f.label.toLowerCase()).slice(0, 4).join(', ')})
              </li>
              {selected.documentTemplate.includeStudentSignature && (
                <li className="flex gap-2.5">
                  <span className="w-4 h-3 border border-dashed border-ink mt-1 shrink-0" />
                  Student signature
                </li>
              )}
              <li className="flex gap-2.5">
                <span className="w-4 h-3 border-2 border-dashed border-teal mt-1 shrink-0" />
                {selected.workflowDefinition.stages.map(x => x.assignedRole).join(' · ') || 'No signers'}
              </li>
            </ul>
            <Button variant="outline" size="lg" className="w-full mt-5" onClick={() => setEditing(selected)}>
              Edit layout
            </Button>
          </Card>
        )}
      </div>
      {editing && <TemplateEditor initial={editing} onClose={() => setEditing(null)} />}
    </AdminShell>
  );
}

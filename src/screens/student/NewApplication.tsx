import React, { useMemo, useRef, useState } from 'react';
import { FileText, Search, ScanLine, Check, Trash2 } from 'lucide-react';
import { useStore } from '../../lib/store';
import { CUSTOM_UPLOAD_TYPE_ID, shortTitle } from '../../lib/constants';
import { extractText, suggestForUpload } from '../../lib/smartScan';
import { setComposition } from '../../lib/composer';
import { TopShell } from '../../ui/Shell';
import { Badge, Button, Card, Modal, TextLink, cx, formatBytes, readFileAsDataUrl, timeAgo } from '../../ui/kit';
import { navigate } from '../../ui/router';
import { toast } from '../../lib/toast';
import { UploadedDocument } from '../../types';

export function Stepper({ step }: { step: 1 | 2 | 3 }) {
  const items = ['Document', 'Approval chain', 'Send'];
  return (
    <ol className="flex flex-wrap gap-2 mb-6" aria-label="Steps">
      {items.map((label, i) => {
        const n = i + 1;
        const done = n < step;
        const cur = n === step;
        return (
          <li key={label} aria-current={cur ? 'step' : undefined} className={cx('inline-flex items-center gap-2.5 h-[38px] pl-1.5 pr-3.5 rounded-full border text-[15px] font-bold', cur ? 'bg-ink text-white border-ink' : 'bg-white border-line text-ink')}>
            <span className={cx('w-[26px] h-[26px] rounded-full inline-flex items-center justify-center text-[13px]', done ? 'bg-ink text-cyan' : cur ? 'bg-cyan text-ink' : 'bg-mist text-mauve')}>
              {done ? <Check size={15} strokeWidth={3} /> : n}
            </span>
            {label}
          </li>
        );
      })}
    </ol>
  );
}

const MAX_MB = 10;
const ACCEPT = '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export function NewApplication() {
  const s = useStore();
  const me = s.currentUser;
  const [q, setQ] = useState('');
  const [drag, setDrag] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [example, setExample] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const types = useMemo(
    () => s.applicationTypes.filter(t => t.active && t.id !== CUSTOM_UPLOAD_TYPE_ID).filter(t => `${t.title} ${t.description} ${t.tag}`.toLowerCase().includes(q.trim().toLowerCase())),
    [s.applicationTypes, q]
  );
  const drafts = s.applications.filter(a => a.studentId === me.id && a.status === 'draft');
  const chainText = (stages: { designationId?: string; assignedRole: string }[]) => stages.map(st => shortTitle(st.assignedRole)).join(' → ');

  const handleFile = async (file?: File) => {
    if (!file) return;
    const okType = /\.(pdf|docx?)$/i.test(file.name);
    if (!okType) {
      toast('error', 'Unsupported file', 'Upload a PDF or Word (.doc, .docx) file.');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast('error', 'File is too large', `The limit is ${MAX_MB} MB.`);
      return;
    }
    setScanning(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const fileType = file.type || (/\.pdf$/i.test(file.name) ? 'application/pdf' : 'application/msword');
      const doc: UploadedDocument = {
        id: `up-${Date.now()}`,
        requirementId: 'doc-original',
        requirementName: 'Uploaded document',
        fileName: file.name,
        fileDataUrl: dataUrl,
        fileSize: file.size,
        fileType,
        uploadedAt: new Date().toISOString(),
        status: 'pending'
      };
      const text = await extractText(doc);
      const scan = suggestForUpload(file.name, text, me, s.designations, s.applicationTypes);
      setComposition({
        typeId: CUSTOM_UPLOAD_TYPE_ID,
        source: 'upload',
        formData: { subject: file.name.replace(/\.(pdf|docx?)$/i, ''), notes: '', student_name: me.name, reg_no: me.registrationNumber, __text: text.slice(0, 600) },
        uploadedDocuments: [doc],
        scan,
        chain: scan.designationIds
      });
      navigate('/new/chain');
    } catch {
      toast('error', 'Could not read the file');
    } finally {
      setScanning(false);
    }
  };

  return (
    <TopShell active="new">
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-8">
        <Stepper step={1} />
        <h1 className="text-[34px] sm:text-[40px] font-extrabold tracking-[-0.02em]">New application</h1>
        <p className="text-[17px] text-mauve mt-1">Fill a university form right here, or upload your own document.</p>

        {drafts.length > 0 && (
          <section className="mt-7" aria-labelledby="drafts">
            <h2 id="drafts" className="text-[20px] font-extrabold mb-3">
              Continue a draft
            </h2>
            <div className="flex flex-wrap gap-3">
              {drafts.map(d => (
                <Card key={d.id} className="flex items-center gap-3 pl-4 pr-2 py-2.5">
                  <FileText size={18} className="text-teal" />
                  <a href={`#/new/form/${d.applicationTypeId}?draft=${d.id}`} className="font-bold no-underline">
                    {d.applicationTypeTitle}
                  </a>
                  <span className="text-sm text-mauve">edited {timeAgo(d.updatedAt)}</span>
                  <button
                    aria-label={`Delete draft ${d.applicationTypeTitle}`}
                    onClick={() => {
                      s.deleteDraft(d.id);
                      toast('info', 'Draft deleted');
                    }}
                    className="w-9 h-9 inline-flex items-center justify-center rounded-full text-mauve hover:bg-mist hover:text-bad"
                  >
                    <Trash2 size={16} />
                  </button>
                </Card>
              ))}
            </div>
          </section>
        )}

        <section className="mt-8" aria-labelledby="forms">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
            <div>
              <h2 id="forms" className="text-[24px] font-extrabold">
                Fill a university form online
              </h2>
              <p className="text-mauve">No downloading or printing. Forms are kept up to date by the admin office.</p>
            </div>
            <label className="relative w-full sm:w-[300px]">
              <span className="sr-only">Search forms</span>
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mauve" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search forms" className="w-full min-h-11 pl-10 pr-3 rounded-[8px] border border-line bg-white focus:outline-none focus:border-teal" />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {types.map((t, i) => (
              <a
                key={t.id}
                href={`#/new/form/${t.id}`}
                className={cx('group flex flex-col bg-white border border-line rounded-[14px] p-5 no-underline hover:border-ink transition-colors', types.length === 6 && i >= 4 && 'lg:col-span-2')}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="w-10 h-10 rounded-[8px] bg-sky inline-flex items-center justify-center">
                    <FileText size={20} />
                  </span>
                  <span className="text-[13px] font-bold text-mauve">{t.tag}</span>
                </div>
                <h3 className="mt-3 text-[19px] font-extrabold">{t.title}</h3>
                <p className="text-[15px] text-mauve mt-1.5 flex-1">{t.description}</p>
                <div className="border-t border-line mt-4 pt-3">
                  <p className="text-[14px] text-mauve">
                    Usually signed by: <strong className="text-ink">{chainText(t.workflowDefinition.stages)}</strong>
                  </p>
                  <span className="inline-block mt-2.5 font-bold text-teal">Fill online →</span>
                </div>
              </a>
            ))}
            {types.length === 0 && <p className="text-mauve col-span-full">No forms match “{q}”.</p>}
          </div>
        </section>

        <div className="flex items-center gap-4 my-10" aria-hidden>
          <div className="flex-1 h-px bg-line" />
          <span className="font-extrabold text-[17px]">OR</span>
          <div className="flex-1 h-px bg-line" />
        </div>

        <section className="grid lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-6" aria-label="Upload your own document">
          <div
            onDragOver={e => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={e => {
              e.preventDefault();
              setDrag(false);
              void handleFile(e.dataTransfer.files?.[0]);
            }}
            className={cx('rounded-[14px] border-2 border-dashed p-8 sm:p-12 flex flex-col sm:flex-row items-center gap-8 transition-colors', drag ? 'border-ink bg-cyan/30' : 'border-teal/60 bg-sky')}
          >
            <svg width="112" height="88" viewBox="0 0 112 88" fill="none" stroke="#111" strokeWidth="5" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 14a6 6 0 0 1 6-6h26l10 10h46a6 6 0 0 1 6 6v52a6 6 0 0 1-6 6H12a6 6 0 0 1-6-6z" />
              <path d="M66 46l30 18-14 3-8 13z" fill="#fff" />
            </svg>
            <div className="text-center sm:text-left">
              <h3 className="text-[24px] font-extrabold">Upload / drag &amp; drop</h3>
              <p className="text-mauve mt-1">PDF or Word (.doc, .docx) · up to {MAX_MB} MB</p>
              <Button size="lg" className="mt-4" onClick={() => fileRef.current?.click()} loading={scanning}>
                {scanning ? 'Scanning…' : 'Choose document'}
              </Button>
              <input ref={fileRef} type="file" accept={ACCEPT} className="sr-only" onChange={e => void handleFile(e.target.files?.[0])} />
            </div>
          </div>
          <Card className="p-6 flex flex-col">
            <span className="w-10 h-10 rounded-[8px] bg-ink text-cyan inline-flex items-center justify-center">
              <ScanLine size={20} />
            </span>
            <h3 className="mt-4 text-[19px] font-extrabold">Smart scan picks the signers</h3>
            <p className="text-[15px] text-mauve mt-2 flex-1">After upload, EzScene reads your document and suggests the approval chain, e.g. Advisor → HoD → Dean. You can change it before sending.</p>
            <TextLink onClick={() => setExample(true)} className="mt-4">
              See an example →
            </TextLink>
          </Card>
        </section>
      </div>

      <Modal open={example} onClose={() => setExample(false)} title="Smart scan example" width={560}>
        <p className="text-mauve">Uploaded: <strong className="text-ink">NOC request — internship at K-Electric.pdf</strong> ({formatBytes(184000)})</p>
        <div className="mt-4 rounded-[12px] bg-sky p-4">
          <p className="text-[12px] font-extrabold tracking-[0.08em] text-mauve">FOUND IN YOUR DOCUMENT</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {['NOC', 'Internship', '56 days', 'Electrical Engineering'].map(t => (
              <Badge key={t} className="bg-white text-ink text-[14px]">{t}</Badge>
            ))}
          </div>
          <p className="text-[12px] font-extrabold tracking-[0.08em] text-mauve mt-4">SUGGESTED CHAIN</p>
          <p className="font-bold mt-1">Course Advisor → Head of Department → Dean</p>
          <ul className="list-disc pl-5 mt-2 text-[15px]">
            <li>NOCs need the department’s and the Dean’s consent.</li>
          </ul>
        </div>
        <p className="text-sm text-mauve mt-3">You can reorder, add or remove signers before sending.</p>
      </Modal>
    </TopShell>
  );
}

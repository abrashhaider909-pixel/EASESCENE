import React, { useEffect, useMemo, useState } from 'react';
import { FileText, Download, ExternalLink } from 'lucide-react';
import { Application, ApplicationType, OfficialDocumentTemplate, SignatureAsset, UserProfile, UploadedDocument } from '../types';
import { boldSegments, formatDate, renderDocumentText } from '../lib/pdfGenerator';
import { ownSignature } from '../lib/access';
import { UNIVERSITY_NAME } from '../config';
import { cx, clock, formatBytes } from './kit';
import { downloadDataUrl } from '../lib/download';

export interface SigBlock {
  key: string;
  label: string;
  name?: string;
  imageUrl?: string;
  signedAt?: string;
  state: 'signed' | 'yours' | 'pending';
}

type DocLike = Pick<Application, 'studentSnapshot' | 'formData' | 'referenceNumber' | 'applicationTypeTitle' | 'submissionDate' | 'updatedAt'>;

export function blocksForApplication(app: Application, type: ApplicationType | undefined, viewer: UserProfile | undefined, signatures: SignatureAsset[], users: UserProfile[]): SigBlock[] {
  const blocks: SigBlock[] = [];
  if (type?.documentTemplate.includeStudentSignature) {
    const issuedStudent = app.issuedDocument?.appliedSignatures.find(s => s.slotId === 'student');
    const student = users.find(u => u.id === app.studentId);
    const sig = issuedStudent?.signatureUrl || (student ? ownSignature(student, signatures)?.imageUrl : undefined);
    blocks.push({ key: 'student', label: 'Student', name: app.studentSnapshot.name, imageUrl: sig, state: sig ? 'signed' : 'pending', signedAt: undefined });
  }
  app.stageInstances.forEach(s => {
    if (s.status === 'completed' && s.signatureApplied) {
      blocks.push({ key: s.stageId, label: s.assignedRole, name: s.actionTakenBy, imageUrl: s.signatureAssetUrl, signedAt: s.completedAt, state: 'signed' });
    } else {
      const yours = s.status === 'in_progress' && viewer && s.assignedStaffId === viewer.id;
      blocks.push({ key: s.stageId, label: s.assignedRole, name: s.assignedStaffName, state: yours ? 'yours' : 'pending' });
    }
  });
  return blocks;
}

function Rich({ text }: { text: string }) {
  return (
    <>
      {boldSegments(text).map((s, i) => (s.bold ? <strong key={i}>{s.text}</strong> : <React.Fragment key={i}>{s.text}</React.Fragment>))}
    </>
  );
}

export function DocumentPreview({
  doc,
  template,
  blocks,
  formLabel,
  showRef = true,
  compact = false,
  footer
}: {
  doc: DocLike;
  template: OfficialDocumentTemplate;
  blocks: SigBlock[];
  formLabel?: string;
  showRef?: boolean;
  compact?: boolean;
  footer?: React.ReactNode;
}) {
  const per = blocks.length <= 2 ? blocks.length || 1 : 3;
  return (
    <article className={cx('bg-white text-ink', compact ? 'px-5 py-6' : 'px-8 sm:px-11 py-10')} aria-label="Document preview">
      <div className="flex items-baseline justify-between gap-3 pb-3 border-b-2 border-ink">
        <span className={cx('font-extrabold uppercase tracking-[0.08em]', compact ? 'text-[10px]' : 'text-[12px]')}>{UNIVERSITY_NAME}</span>
        {(formLabel || showRef) && <span className={cx('text-mauve', compact ? 'text-[10px]' : 'text-[12px]')}>{formLabel || `Ref. ${doc.referenceNumber}`}</span>}
      </div>
      <h3 className={cx('text-center font-semibold uppercase tracking-[0.14em]', compact ? 'text-[13px] my-5' : 'text-[16px] my-7')}>{renderDocumentText(template.title, doc).replace(/\*\*/g, '')}</h3>
      <div className={cx('space-y-3.5 leading-[1.75]', compact ? 'text-[13px]' : 'text-[15px]')} style={{ fontFamily: 'var(--font-serif)' }}>
        {template.bodyParagraphs.map((p, i) => (
          <p key={i}>
            <Rich text={renderDocumentText(p, doc)} />
          </p>
        ))}
      </div>
      {blocks.length > 0 && (
        <div className={cx('grid gap-4 sm:gap-5', compact ? 'mt-6' : 'mt-9')} style={{ gridTemplateColumns: `repeat(${per}, minmax(0, 1fr))` }}>
          {blocks.map(b => (
            <div key={b.key} className="min-w-0">
              {b.state === 'signed' ? (
                <>
                  <div className={cx('flex items-end', compact ? 'h-10' : 'h-12')}>{b.imageUrl && <img src={b.imageUrl} alt={`Signature of ${b.name}`} className="max-h-full max-w-full object-contain object-left" />}</div>
                  <div className="border-t-[1.5px] border-ink pt-1.5">
                    {b.name && b.label !== 'Student' && <p className="text-[12px] font-bold truncate">{b.name}</p>}
                    <p className={cx('truncate', b.label !== 'Student' && b.name ? 'text-[11px] text-mauve' : 'text-[12px] font-bold')}>{b.label}</p>
                    {b.signedAt && <p className="text-[11px] font-bold text-ok">Signed {formatDate(b.signedAt).replace(/ \d{4}$/, '')} · {clock(b.signedAt)}</p>}
                  </div>
                </>
              ) : (
                <>
                  <div className={cx('flex items-center justify-center rounded-[4px] border-2 border-dashed text-center font-bold px-1', compact ? 'h-12 text-[10px]' : 'h-14 text-[12px]', b.state === 'yours' ? 'border-teal bg-skylight text-teal' : 'border-teal/60 bg-[#EEF7FA] text-teal')}>
                    {b.state === 'yours' ? 'Your signature goes here' : 'Stamped on approval'}
                  </div>
                  <p className="text-[12px] font-bold mt-1.5 truncate">{b.label}</p>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      {footer}
    </article>
  );
}

/** Live preview helper used while filling a form. */
export function useDocPreview(type: ApplicationType | undefined, formData: Record<string, any>, me: UserProfile) {
  return useMemo<DocLike>(
    () => ({
      studentSnapshot: { name: me.name, registrationNumber: me.registrationNumber || '', email: me.email, department: me.department, phone: me.phone },
      formData,
      referenceNumber: 'New request',
      applicationTypeTitle: type?.title || '',
      submissionDate: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }),
    [type, formData, me]
  );
}

/** Shows a student's own uploaded file (PDF in a frame, images inline). */
export function OriginalFile({ file, height = 520 }: { file: UploadedDocument; height?: number }) {
  const [url, setUrl] = useState<string>('');
  useEffect(() => {
    if (!file.fileDataUrl.startsWith('data:')) return;
    try {
      const comma = file.fileDataUrl.indexOf(',');
      const bin = atob(file.fileDataUrl.slice(comma + 1));
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
      const u = URL.createObjectURL(new Blob([bytes], { type: file.fileType }));
      setUrl(u);
      return () => URL.revokeObjectURL(u);
    } catch {
      setUrl(file.fileDataUrl);
    }
  }, [file]);
  const isPdf = file.fileType === 'application/pdf';
  const isImage = file.fileType.startsWith('image/');
  return (
    <div className="bg-white">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-line">
        <FileText size={18} className="text-teal shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-bold truncate">{file.fileName}</p>
          <p className="text-xs text-mauve">{file.requirementName} · {formatBytes(file.fileSize)}</p>
        </div>
        {url && isPdf && (
          <a href={url} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-sm font-bold text-teal">
            <ExternalLink size={15} /> Open
          </a>
        )}
        <button onClick={() => downloadDataUrl(file.fileDataUrl, file.fileName)} className="inline-flex items-center gap-1 text-sm font-bold text-teal">
          <Download size={15} /> Download
        </button>
      </div>
      {isPdf && url && <iframe title={file.fileName} src={url} className="w-full block bg-paper" style={{ height }} />}
      {isImage && <img src={file.fileDataUrl} alt={file.fileName} className="max-w-full mx-auto block" />}
      {!isPdf && !isImage && <p className="p-6 text-mauve text-sm">Word documents can’t be previewed in the browser. Download the file to read it.</p>}
    </div>
  );
}

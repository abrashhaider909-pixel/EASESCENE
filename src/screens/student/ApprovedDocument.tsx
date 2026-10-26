import { useEffect, useState } from 'react';
import { Check, Download, Printer, ShieldCheck } from 'lucide-react';
import QRCode from 'qrcode';
import { useStore } from '../../lib/store';
import { canViewApplication } from '../../lib/access';
import { TopShell } from '../../ui/Shell';
import { Button, Card, EmptyState, LinkButton, TextLink, clock, formatBytes } from '../../ui/kit';
import { DocumentPreview, blocksForApplication } from '../../ui/DocumentPreview';
import { requestTitle } from '../../ui/appText';
import { formatDate, dataUrlToBytes } from '../../lib/pdfGenerator';
import { downloadDataUrl, inHostedViewer } from '../../lib/download';
import { verificationUrl } from '../../config';
import { toast } from '../../lib/toast';
import { Application } from '../../types';

export function printPdf(dataUrl: string) {
  try {
    const bytes = dataUrlToBytes(dataUrl);
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    frame.src = url;
    frame.onload = () => {
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
      } catch {
        window.open(url, '_blank');
      }
      setTimeout(() => {
        frame.remove();
        URL.revokeObjectURL(url);
      }, 60000);
    };
    document.body.appendChild(frame);
  } catch {
    toast('error', 'Could not open the print dialog', 'Download the PDF and print it instead.');
  }
}

export function fileNameFor(app: Application) {
  return `${app.referenceNumber}_${requestTitle(app, false).replace(/[^\w]+/g, '_')}.pdf`;
}

export function DocFooter({ app }: { app: Application }) {
  const [qr, setQr] = useState('');
  const id = app.issuedDocument?.verificationCode || app.referenceNumber;
  const hash = app.issuedDocument?.documentHash || '';
  useEffect(() => {
    QRCode.toDataURL(verificationUrl(id), { margin: 1, width: 160 }).then(setQr).catch(() => setQr(''));
  }, [id]);
  return (
    <div className="mt-9 pt-5 border-t border-line flex items-center gap-4">
      {qr ? <img src={qr} alt={`QR code to verify ${id}`} className="w-16 h-16 border border-ink p-0.5" /> : <div className="w-16 h-16 border border-ink" />}
      <div className="text-[12px] min-w-0">
        <p className="font-bold">Digitally signed via EzScene · ID {id}</p>
        <p className="text-mauve break-all">
          Verify at <span className="underline">{verificationUrl(id).replace(/^https?:\/\//, '')}</span> · SHA-256 {hash.slice(0, 4)} {hash.slice(4, 8)} … {hash.slice(-8, -4)} {hash.slice(-4)}
        </p>
      </div>
    </div>
  );
}

export function ApprovedDocument({ id }: { id: string }) {
  const s = useStore();
  const app = s.applications.find(a => a.id === id);
  const [preparing, setPreparing] = useState(false);

  useEffect(() => {
    if (app?.issuedDocument && !app.issuedDocument.pdfDataUrl) {
      setPreparing(true);
      s.ensureIssuedPdf(app.id).finally(() => setPreparing(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app?.id]);

  if (!app || !canViewApplication(s.currentUser, app) || !app.issuedDocument) {
    return (
      <TopShell active="requests">
        <EmptyState title="Document not available" action={<LinkButton to="/requests">My requests</LinkButton>}>
          The document is ready once every signer has approved.
        </EmptyState>
      </TopShell>
    );
  }

  const type = s.applicationTypes.find(t => t.id === app.applicationTypeId);
  const issued = app.issuedDocument;
  const pdf = issued.pdfDataUrl;
  const size = pdf ? Math.round((pdf.length - pdf.indexOf(',') - 1) * 0.75) : 0;
  const staffSigs = issued.appliedSignatures.filter(x => x.slotId !== 'student');

  return (
    <TopShell active="requests">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-10 py-8">
        <TextLink to={`/requests/${app.id}`}>← My requests</TextLink>
        <div className="mt-4 rounded-[14px] bg-okbg border border-ok/40 px-5 py-4 flex items-center gap-4">
          <span className="w-11 h-11 rounded-full bg-ok text-white inline-flex items-center justify-center shrink-0">
            <Check size={22} strokeWidth={3} />
          </span>
          <div>
            <p className="text-[20px] sm:text-[22px] font-extrabold text-ok">{requestTitle(app)} is fully approved</p>
            <p className="text-ok">
              All {staffSigs.length} signatures stamped · completed {formatDate(issued.generatedAt)}, {clock(issued.generatedAt)}
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] gap-6 mt-5 items-start">
          <div className="rounded-[16px] bg-[#D9C5CC] p-4 sm:p-7">
            <div className="max-w-[740px] mx-auto shadow-[0_18px_40px_rgba(60,30,40,0.22)]">
              {type && <DocumentPreview doc={app} template={type.documentTemplate} blocks={blocksForApplication(app, type, s.currentUser, s.signatures, s.users)} footer={<DocFooter app={app} />} />}
            </div>
            {app.source === 'upload' && <p className="text-center text-sm text-mauve mt-4">The PDF contains your original pages followed by this signed approval sheet.</p>}
          </div>

          <div className="flex flex-col gap-4">
            <Card className="p-5">
              <Button size="lg" className="w-full text-[19px]" disabled={!pdf} loading={preparing} onClick={() => pdf && downloadDataUrl(pdf, fileNameFor(app))}>
                <Download size={20} /> Download PDF
              </Button>
              {!inHostedViewer() && (
                <Button variant="outline" size="lg" className="w-full mt-2.5 text-[18px]" disabled={!pdf} onClick={() => pdf && printPdf(pdf)}>
                  <Printer size={20} /> Print
                </Button>
              )}
              <dl className="grid grid-cols-[96px_1fr] gap-y-2 mt-5 text-[15px]">
                <dt className="text-mauve">Format</dt>
                <dd className="font-bold">PDF · A4, print-ready</dd>
                <dt className="text-mauve">Pages</dt>
                <dd className="font-bold">{issued.pageCount || 1}</dd>
                <dt className="text-mauve">Size</dt>
                <dd className="font-bold">{pdf ? formatBytes(size) : '—'}</dd>
                <dt className="text-mauve">Signatures</dt>
                <dd className="font-bold">
                  {staffSigs.length} of {app.stageInstances.length} stamped
                </dd>
              </dl>
            </Card>
            <Card className="p-5">
              <h2 className="text-[19px] font-extrabold mb-3">Signature trail</h2>
              <ol className="flex flex-col gap-3">
                {staffSigs.map((g, i) => (
                  <li key={g.slotId} className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-okbg text-ok text-[13px] font-extrabold inline-flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                    <span>
                      <span className="block font-bold">{g.roleTitle}</span>
                      <span className="block text-[15px] text-mauve">
                        {g.staffName} · {formatDate(g.timestamp).replace(/ \d{4}$/, '')}, {clock(g.timestamp)}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </Card>
            <div className="rounded-[14px] bg-sky p-5 flex gap-3">
              <ShieldCheck size={22} className="shrink-0" />
              <p className="text-[15px]">Anyone receiving this PDF can confirm it’s genuine with its ID. Any edit after signing breaks the fingerprint.</p>
            </div>
          </div>
        </div>
      </div>
    </TopShell>
  );
}

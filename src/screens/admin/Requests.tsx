import { routeQuery } from '../../ui/router';
import { useMemo, useState } from 'react';
import { Search, Timer, Download } from 'lucide-react';
import { useStore } from '../../lib/store';
import { AdminShell } from '../../ui/Shell';
import { Badge, Button, Card, Input, Modal, PageTitle, Select, clock } from '../../ui/kit';
import { DocumentPreview, OriginalFile, blocksForApplication } from '../../ui/DocumentPreview';
import { requestTitle, statusOf } from '../../ui/appText';
import { formatDate } from '../../lib/pdfGenerator';
import { downloadDataUrl } from '../../lib/download';
import { evaluateStageSLA } from '../../lib/slaEngine';
import { fileNameFor } from '../student/ApprovedDocument';
import { toast } from '../../lib/toast';
import { Application } from '../../types';

export function Requests() {
  const s = useStore();
  const params = routeQuery();
  const [q, setQ] = useState(params.get('q') || '');
  const [status, setStatus] = useState('all');
  const [open, setOpen] = useState<Application | null>(null);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return s.applications
      .filter(a => a.status !== 'draft')
      .filter(a => status === 'all' || (status === 'live' ? !['completed', 'rejected', 'cancelled'].includes(a.status) : a.status === status))
      .filter(a => !term || `${a.referenceNumber} ${a.studentSnapshot.name} ${a.studentSnapshot.registrationNumber} ${a.applicationTypeTitle} ${a.formData.subject || ''}`.toLowerCase().includes(term))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [s.applications, q, status]);

  const live = s.applications.filter(a => !['completed', 'rejected', 'cancelled', 'draft'].includes(a.status));
  const overdue = live.filter(a => {
    const st = a.stageInstances[a.currentStageIndex];
    return st && evaluateStageSLA(st).isOverdue;
  }).length;
  const current = open ? s.applications.find(a => a.id === open.id) || open : null;
  const type = current ? s.applicationTypes.find(t => t.id === current.applicationTypeId) : undefined;

  return (
    <AdminShell active="requests">
      <PageTitle
        title="All requests"
        sub="Every request across the university, with where it is right now."
        right={
          <Button
            variant="outline"
            onClick={() => {
              const r = s.triggerSLACheck();
              toast('info', 'Deadline check complete', `${r.checkedCount} open · ${r.warningsGenerated} warnings · ${r.escalationsTriggered} escalations`);
            }}
          >
            <Timer size={17} /> Run deadline check
          </Button>
        }
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          ['In progress', live.length],
          ['Past deadline', overdue],
          ['Approved', s.applications.filter(a => a.status === 'completed').length],
          ['Rejected', s.applications.filter(a => a.status === 'rejected').length]
        ].map(([label, n]) => (
          <Card key={label as string} className="p-4">
            <p className="text-sm font-bold text-mauve">{label}</p>
            <p className="text-[30px] font-extrabold">{n}</p>
          </Card>
        ))}
      </div>
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <label className="relative flex-1">
          <span className="sr-only">Search requests</span>
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mauve" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search ID, student, CMS ID or form" className="pl-10" />
        </label>
        <Select aria-label="Status" value={status} onChange={e => setStatus(e.target.value)} className="sm:w-[200px]">
          <option value="all">All statuses</option>
          <option value="live">In progress</option>
          <option value="awaiting_student_action">Changes requested</option>
          <option value="completed">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="cancelled">Withdrawn</option>
        </Select>
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left">
          <thead>
            <tr className="text-[13px] font-extrabold tracking-[0.06em] text-mauve uppercase border-b border-line">
              <th className="px-5 py-4">ID</th>
              <th className="px-3 py-4">Request</th>
              <th className="px-3 py-4">Student</th>
              <th className="px-3 py-4">Status</th>
              <th className="px-3 py-4">Current desk</th>
              <th className="px-3 py-4">Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a, i) => {
              const st = statusOf(a);
              const stage = a.stageInstances[a.currentStageIndex];
              const sla = stage && stage.status === 'in_progress' ? evaluateStageSLA(stage) : null;
              return (
                <tr key={a.id} className={`${i % 2 ? 'bg-paper' : 'bg-white'} cursor-pointer hover:bg-skylight`} onClick={() => setOpen(a)}>
                  <td className="px-5 py-3 font-mono text-[14px]">
                    <button className="font-bold underline-offset-2 hover:underline" onClick={() => setOpen(a)}>
                      {a.referenceNumber}
                    </button>
                  </td>
                  <td className="px-3 py-3 font-bold">{requestTitle(a)}</td>
                  <td className="px-3 py-3 text-[15px]">
                    {a.studentSnapshot.name}
                    <span className="block text-[13px] text-mauve">{a.studentSnapshot.registrationNumber}</span>
                  </td>
                  <td className="px-3 py-3">
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </td>
                  <td className="px-3 py-3 text-[15px]">
                    {stage && stage.status === 'in_progress' && !['cancelled'].includes(a.status) ? (
                      <>
                        {stage.assignedStaffName}
                        <span className={`block text-[13px] ${sla?.isOverdue ? 'text-bad font-bold' : 'text-mauve'}`}>{sla?.isOverdue ? `Overdue ${sla.hoursOverdue}h` : sla?.formattedRemaining ? `${sla.formattedRemaining} left` : stage.assignedRole}</span>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-3 text-[14px] whitespace-nowrap">
                    {formatDate(a.updatedAt)}, {clock(a.updatedAt)}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-mauve">
                  No requests match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Modal open={Boolean(current)} onClose={() => setOpen(null)} title={current ? `${current.referenceNumber} · ${requestTitle(current)}` : ''} width={860}>
        {current && type && (
          <div className="flex flex-col gap-4">
            {current.issuedDocument && (
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={async () => {
                    const a = await s.ensureIssuedPdf(current.id);
                    if (a?.issuedDocument?.pdfDataUrl) downloadDataUrl(a.issuedDocument.pdfDataUrl, fileNameFor(a));
                  }}
                >
                  <Download size={17} /> Download issued PDF
                </Button>
              </div>
            )}
            {current.source === 'upload' && current.uploadedDocuments[0] && (
              <div className="rounded-[8px] border border-line overflow-hidden">
                <OriginalFile file={current.uploadedDocuments[0]} height={420} />
              </div>
            )}
            <div className="rounded-[6px] border border-line overflow-hidden">
              <DocumentPreview doc={current} template={type.documentTemplate} blocks={blocksForApplication(current, type, undefined, s.signatures, s.users)} />
            </div>
            <div>
              <p className="font-extrabold mb-2">Timeline</p>
              <ol className="flex flex-col gap-2">
                {[...current.timeline].reverse().map(e => (
                  <li key={e.id} className="text-[15px]">
                    <strong>{e.title}</strong>
                    <span className="text-mauve">
                      {' '}
                      · {formatDate(e.timestamp)}, {clock(e.timestamp)}
                      {e.description ? ` · ${e.description}` : ''}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </Modal>
    </AdminShell>
  );
}

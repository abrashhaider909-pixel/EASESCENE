import { useMemo, useState } from 'react';
import { Plus, Search, Trash2, Pencil } from 'lucide-react';
import { useStore } from '../../lib/store';
import { AdminShell } from '../../ui/Shell';
import { Button, Card, Checkbox, Field, Input, Modal, PageTitle, Select } from '../../ui/kit';
import { toast } from '../../lib/toast';
import { Designation } from '../../types';

const sinceLabel = (iso: string) => {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
};

export function Designations() {
  const s = useStore();
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('all');
  const [pending, setPending] = useState<{ des: Designation; holderId: string } | null>(null);
  const [editing, setEditing] = useState<Partial<Designation> | null>(null);
  const staff = s.users.filter(u => u.role === 'staff' && u.active).sort((a, b) => a.name.localeCompare(b.name));
  const departments = Array.from(new Set(s.designations.map(d => d.department))).sort();

  const pendingCount = (id: string) => s.applications.filter(a => {
    const st = a.stageInstances[a.currentStageIndex];
    return st?.designationId === id && st.status === 'in_progress' && ['pending_signature', 'pending_approval', 'under_verification', 'overdue', 'submitted', 'awaiting_student_action'].includes(a.status);
  }).length;

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return s.designations
      .filter(d => dept === 'all' || d.department === dept)
      .filter(d => !term || `${d.title} ${d.department} ${d.scope || ''} ${s.users.find(u => u.id === d.holderId)?.name || ''}`.toLowerCase().includes(term))
      .sort((a, b) => a.order - b.order);
  }, [s.designations, s.users, q, dept]);

  const save = () => {
    if (!editing?.title?.trim() || !editing.department?.trim()) {
      toast('error', 'Title and department are required');
      return;
    }
    if (editing.id) {
      const prev = s.designations.find(d => d.id === editing.id)!;
      s.updateDesignation(editing.id, { title: editing.title.trim(), department: editing.department.trim(), scope: editing.scope?.trim() || undefined, reach: editing.reach || 'department', affixesSeal: Boolean(editing.affixesSeal) });
      if (editing.holderId && editing.holderId !== prev.holderId) s.reassignDesignation(editing.id, editing.holderId);
      toast('success', 'Designation updated');
    } else {
      s.addDesignation({ title: editing.title.trim(), department: editing.department.trim(), scope: editing.scope?.trim() || undefined, reach: editing.reach || 'department', holderId: editing.holderId || undefined, affixesSeal: Boolean(editing.affixesSeal) });
      toast('success', 'Designation added', 'Students can now add it to their approval chains.');
    }
    setEditing(null);
  };

  return (
    <AdminShell active="designations">
      <PageTitle
        title="Designations & role mapping"
        sub="When leadership changes, reassign the designation. Pending documents move to the new holder; past signatures stay with whoever signed them."
        right={
          <Button size="lg" onClick={() => setEditing({ reach: 'department', affixesSeal: false })}>
            <Plus size={18} /> Add designation
          </Button>
        }
      />
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <label className="relative flex-1">
          <span className="sr-only">Search designations or people</span>
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mauve" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search designations or people" className="pl-10" />
        </label>
        <Select aria-label="Department" value={dept} onChange={e => setDept(e.target.value)} className="sm:w-[200px]">
          <option value="all">All departments</option>
          {departments.map(d => (
            <option key={d}>{d}</option>
          ))}
        </Select>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left">
          <thead>
            <tr className="text-[13px] font-extrabold tracking-[0.06em] text-mauve uppercase border-b border-line">
              <th className="px-5 py-4">Designation</th>
              <th className="px-3 py-4">Department</th>
              <th className="px-3 py-4">Assigned to</th>
              <th className="px-3 py-4">Since</th>
              <th className="px-3 py-4">Pending</th>
              <th className="px-3 py-4 w-[88px]"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d, i) => (
              <tr key={d.id} className={i % 2 ? 'bg-paper' : 'bg-white'}>
                <td className="px-5 py-3.5 font-bold text-[16px]">{d.title}</td>
                <td className="px-3 py-3.5 text-[15px] text-mauve">
                  {d.scope || d.department}
                  {d.scope && <span className="block text-xs">{d.department}</span>}
                </td>
                <td className="px-3 py-2.5">
                  <Select
                    aria-label={`Holder of ${d.title}, ${d.department}`}
                    value={d.holderId || ''}
                    onChange={e => e.target.value && setPending({ des: d, holderId: e.target.value })}
                    className="min-h-11 w-[260px]"
                  >
                    {!d.holderId && <option value="">Vacant — choose a person</option>}
                    {staff.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </Select>
                </td>
                <td className="px-3 py-3.5 text-[15px]">{sinceLabel(d.since)}</td>
                <td className="px-3 py-3.5 font-extrabold">{pendingCount(d.id)}</td>
                <td className="px-3 py-3.5">
                  <div className="flex">
                    <button aria-label={`Edit ${d.title}`} onClick={() => setEditing({ ...d })} className="w-9 h-9 inline-flex items-center justify-center rounded-full hover:bg-mist">
                      <Pencil size={16} />
                    </button>
                    <button
                      aria-label={`Remove ${d.title}`}
                      onClick={() => {
                        const r = s.deleteDesignation(d.id);
                        if (r.ok) toast('info', 'Designation removed');
                        else toast('error', 'Can’t remove yet', r.error);
                      }}
                      className="w-9 h-9 inline-flex items-center justify-center rounded-full hover:bg-mist text-bad"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-mauve">
                  No designations match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Modal open={Boolean(pending)} onClose={() => setPending(null)} title="Reassign designation?">
        {pending && (
          <>
            <p className="text-[16px]">
              <strong>{pending.des.title}</strong> ({pending.des.department}) moves from <strong>{s.users.find(u => u.id === pending.des.holderId)?.name || 'vacant'}</strong> to <strong>{s.users.find(u => u.id === pending.holderId)?.name}</strong>.
            </p>
            <p className="text-mauve mt-2">
              {pendingCount(pending.des.id)} pending request{pendingCount(pending.des.id) === 1 ? '' : 's'} will move to the new holder’s inbox. Signatures already applied stay with whoever signed them. This is written to the audit log.
            </p>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setPending(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const moved = s.reassignDesignation(pending.des.id, pending.holderId);
                  toast('success', 'Designation reassigned', `${moved} pending request${moved === 1 ? '' : 's'} moved.`);
                  setPending(null);
                }}
              >
                Reassign
              </Button>
            </div>
          </>
        )}
      </Modal>

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.id ? 'Edit designation' : 'Add designation'}>
        {editing && (
          <div className="flex flex-col gap-4">
            <Field label="Designation" htmlFor="d-title">
              <Input id="d-title" value={editing.title || ''} onChange={e => setEditing({ ...editing, title: e.target.value })} placeholder="e.g. Head of Department" />
            </Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Department" htmlFor="d-dept">
                <Input id="d-dept" list="dept-list" value={editing.department || ''} onChange={e => setEditing({ ...editing, department: e.target.value })} />
                <datalist id="dept-list">
                  {departments.map(x => (
                    <option key={x} value={x} />
                  ))}
                </datalist>
              </Field>
              <Field label="Scope (optional)" htmlFor="d-scope">
                <Input id="d-scope" value={editing.scope || ''} onChange={e => setEditing({ ...editing, scope: e.target.value })} placeholder="e.g. EE-15 A" />
              </Field>
            </div>
            <Field label="Offered to" htmlFor="d-reach">
              <Select id="d-reach" value={editing.reach || 'department'} onChange={e => setEditing({ ...editing, reach: e.target.value as Designation['reach'] })}>
                <option value="department">Students of this department</option>
                <option value="university">Every student</option>
              </Select>
            </Field>
            <Field label="Assigned to" htmlFor="d-holder">
              <Select id="d-holder" value={editing.holderId || ''} onChange={e => setEditing({ ...editing, holderId: e.target.value })}>
                <option value="">Vacant</option>
                {staff.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} — {u.department}
                  </option>
                ))}
              </Select>
            </Field>
            <Checkbox id="d-seal" checked={Boolean(editing.affixesSeal)} onChange={v => setEditing({ ...editing, affixesSeal: v })} label="Also affix the department seal when this designation signs" />
            <div className="flex justify-end gap-3 mt-2">
              <Button variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button onClick={save}>{editing.id ? 'Save changes' : 'Add designation'}</Button>
            </div>
          </div>
        )}
      </Modal>
    </AdminShell>
  );
}

import { useMemo, useState } from 'react';
import { Plus, Search, KeyRound, Trash2, Power } from 'lucide-react';
import { useStore } from '../../lib/store';
import { PROGRAMMES, DEPARTMENTS } from '../../lib/constants';
import { AdminShell } from '../../ui/Shell';
import { Avatar, Badge, Button, Card, Chip, Field, Input, Modal, PageTitle, Select } from '../../ui/kit';
import { toast } from '../../lib/toast';
import { UserProfile } from '../../types';

type Draft = { role: UserProfile['role']; name: string; email: string; password: string; cms: string; programme: string; department: string; designationId: string; designationTitle: string };

export function Users() {
  const s = useStore();
  const [q, setQ] = useState('');
  const [role, setRole] = useState<'all' | UserProfile['role']>('all');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [resetting, setResetting] = useState<UserProfile | null>(null);
  const [tempPw, setTempPw] = useState('');
  const [deleting, setDeleting] = useState<UserProfile | null>(null);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return s.users
      .filter(u => role === 'all' || u.role === role)
      .filter(u => !term || `${u.name} ${u.email} ${u.registrationNumber || ''} ${u.designation || ''} ${u.department}`.toLowerCase().includes(term))
      .sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name));
  }, [s.users, q, role]);

  const vacant = s.designations.filter(d => !d.holderId);

  const create = () => {
    if (!draft) return;
    const email = draft.email.trim().toLowerCase();
    if (!draft.name.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      toast('error', 'Enter a name and a valid email');
      return;
    }
    if (draft.password.length < 6) {
      toast('error', 'Temporary password must be at least 6 characters');
      return;
    }
    if (draft.role === 'student' && !/^\d{5,8}$/.test(draft.cms)) {
      toast('error', 'CMS ID should be 5–8 digits');
      return;
    }
    const des = s.designations.find(d => d.id === draft.designationId);
    const user: UserProfile = {
      id: `${draft.role}-${Date.now()}`,
      name: draft.name.trim(),
      email,
      password: draft.password,
      role: draft.role,
      department: draft.role === 'student' ? (/Computer/.test(draft.programme) ? 'Computer Science' : /Mechanical/.test(draft.programme) ? 'Mechanical Engineering' : 'Electrical Engineering') : des?.department || draft.department,
      designation: draft.role === 'staff' ? des?.title || draft.designationTitle || 'Faculty' : draft.role === 'admin' ? 'Administrator' : undefined,
      registrationNumber: draft.role === 'student' ? draft.cms : undefined,
      semester: draft.role === 'student' ? draft.programme : undefined,
      phone: '',
      active: true
    };
    try {
      s.addUser(user);
      if (des) s.reassignDesignation(des.id, user.id);
      toast('success', 'Account created', `Share the temporary password with ${user.name} securely.`);
      setDraft(null);
    } catch (e: any) {
      toast('error', 'Could not create account', e?.message);
    }
  };

  return (
    <AdminShell active="users">
      <PageTitle
        title="User accounts"
        sub="Provision faculty and admin accounts, deactivate people who leave, and reset passwords."
        right={
          <Button size="lg" onClick={() => setDraft({ role: 'staff', name: '', email: '', password: '', cms: '', programme: PROGRAMMES[0], department: DEPARTMENTS[0], designationId: '', designationTitle: '' })}>
            <Plus size={18} /> Add account
          </Button>
        }
      />
      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <label className="relative flex-1">
          <span className="sr-only">Search accounts</span>
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mauve" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, email, CMS ID or designation" className="pl-10" />
        </label>
        <div className="flex flex-wrap gap-2">
          {(['all', 'student', 'staff', 'admin'] as const).map(r => (
            <Chip key={r} active={role === r} onClick={() => setRole(r)} count={r === 'all' ? s.users.length : s.users.filter(u => u.role === r).length}>
              {{ all: 'All', student: 'Students', staff: 'Faculty', admin: 'Admins' }[r]}
            </Chip>
          ))}
        </div>
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left">
          <thead>
            <tr className="text-[13px] font-extrabold tracking-[0.06em] text-mauve uppercase border-b border-line">
              <th className="px-5 py-4">Person</th>
              <th className="px-3 py-4">Role</th>
              <th className="px-3 py-4">Department / designation</th>
              <th className="px-3 py-4">Status</th>
              <th className="px-3 py-4"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u, i) => {
              const self = u.id === s.currentUser.id;
              return (
                <tr key={u.id} className={i % 2 ? 'bg-paper' : 'bg-white'}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={u.name} size={38} tone={u.role === 'student' ? 'cyan' : 'ink'} />
                      <div className="min-w-0">
                        <p className="font-bold">{u.name}</p>
                        <p className="text-[13px] text-mauve">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-[15px]">{u.role === 'student' ? `Student · ${u.registrationNumber}` : u.role === 'staff' ? 'Faculty' : 'Admin'}</td>
                  <td className="px-3 py-3 text-[15px]">
                    <span className="block">{u.role === 'student' ? u.semester : s.designations.filter(d => d.holderId === u.id).map(d => d.title).join(', ') || u.designation}</span>
                    <span className="block text-[13px] text-mauve">{u.department}</span>
                  </td>
                  <td className="px-3 py-3">
                    <Badge tone={u.active ? 'ok' : 'mist'}>{u.active ? 'Active' : 'Deactivated'}</Badge>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex gap-1">
                      <button aria-label={`Reset password for ${u.name}`} title="Reset password" onClick={() => { setResetting(u); setTempPw(''); }} className="w-9 h-9 inline-flex items-center justify-center rounded-full hover:bg-mist">
                        <KeyRound size={16} />
                      </button>
                      {!self && (
                        <button
                          aria-label={`${u.active ? 'Deactivate' : 'Activate'} ${u.name}`}
                          title={u.active ? 'Deactivate' : 'Activate'}
                          onClick={() => {
                            s.updateUser(u.id, { active: !u.active }, 'USER_UPDATED', `${u.name} ${u.active ? 'deactivated' : 'activated'}`);
                            toast('info', `${u.name} ${u.active ? 'deactivated' : 'activated'}`);
                          }}
                          className="w-9 h-9 inline-flex items-center justify-center rounded-full hover:bg-mist"
                        >
                          <Power size={16} />
                        </button>
                      )}
                      {!self && (
                        <button aria-label={`Delete ${u.name}`} title="Delete" onClick={() => setDeleting(u)} className="w-9 h-9 inline-flex items-center justify-center rounded-full hover:bg-mist text-bad">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Modal open={Boolean(draft)} onClose={() => setDraft(null)} title="Add account">
        {draft && (
          <div className="flex flex-col gap-4">
            <Field label="Role" htmlFor="u-role">
              <Select id="u-role" value={draft.role} onChange={e => setDraft({ ...draft, role: e.target.value as Draft['role'] })}>
                <option value="staff">Faculty / authority</option>
                <option value="student">Student</option>
                <option value="admin">Administrator</option>
              </Select>
            </Field>
            <Field label="Full name" htmlFor="u-name">
              <Input id="u-name" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
            </Field>
            <Field label="Email" htmlFor="u-email">
              <Input id="u-email" type="email" value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })} />
            </Field>
            {draft.role === 'student' && (
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="CMS ID" htmlFor="u-cms">
                  <Input id="u-cms" inputMode="numeric" value={draft.cms} onChange={e => setDraft({ ...draft, cms: e.target.value.replace(/\D/g, '') })} />
                </Field>
                <Field label="Programme" htmlFor="u-prog">
                  <Select id="u-prog" value={draft.programme} onChange={e => setDraft({ ...draft, programme: e.target.value })}>
                    {PROGRAMMES.map(p => (
                      <option key={p}>{p}</option>
                    ))}
                  </Select>
                </Field>
              </div>
            )}
            {draft.role === 'staff' && (
              <>
                <Field label="Assign a vacant designation (optional)" htmlFor="u-des" hint={vacant.length ? undefined : 'No vacant designations. You can reassign an existing one from Designations after creating the account.'}>
                  <Select id="u-des" value={draft.designationId} onChange={e => setDraft({ ...draft, designationId: e.target.value })}>
                    <option value="">None</option>
                    {vacant.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.title} — {d.department}
                      </option>
                    ))}
                  </Select>
                </Field>
                {!draft.designationId && (
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Department" htmlFor="u-dept">
                      <Select id="u-dept" value={draft.department} onChange={e => setDraft({ ...draft, department: e.target.value })}>
                        {DEPARTMENTS.map(d => (
                          <option key={d}>{d}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Title" htmlFor="u-title">
                      <Input id="u-title" value={draft.designationTitle} onChange={e => setDraft({ ...draft, designationTitle: e.target.value })} placeholder="e.g. Assistant Professor" />
                    </Field>
                  </div>
                )}
              </>
            )}
            <Field label="Temporary password" htmlFor="u-pw" hint="They can change it in Profile after logging in.">
              <Input id="u-pw" value={draft.password} onChange={e => setDraft({ ...draft, password: e.target.value })} />
            </Field>
            <div className="flex justify-end gap-3 mt-2">
              <Button variant="outline" onClick={() => setDraft(null)}>
                Cancel
              </Button>
              <Button onClick={create}>Create account</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={Boolean(resetting)} onClose={() => setResetting(null)} title={`Reset password · ${resetting?.name}`}>
        <Field label="New temporary password" htmlFor="tmp-pw" hint="At least 6 characters. Share it securely.">
          <Input id="tmp-pw" value={tempPw} onChange={e => setTempPw(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={() => setResetting(null)}>
            Cancel
          </Button>
          <Button
            disabled={tempPw.length < 6}
            onClick={() => {
              if (!resetting) return;
              s.updateUser(resetting.id, { password: tempPw }, 'PASSWORD_RESET', `Administrator reset the password for ${resetting.name}`);
              toast('success', 'Password reset');
              setResetting(null);
            }}
          >
            Set password
          </Button>
        </div>
      </Modal>

      <Modal open={Boolean(deleting)} onClose={() => setDeleting(null)} title={`Delete ${deleting?.name}?`}>
        <p className="text-mauve">Their requests and signatures stay in the record. Deactivating is usually better — it can be undone.</p>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (!deleting) return;
              try {
                s.deleteUser(deleting.id);
                toast('info', 'Account deleted');
              } catch (e: any) {
                toast('error', 'Can’t delete yet', e?.message);
              }
              setDeleting(null);
            }}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </AdminShell>
  );
}

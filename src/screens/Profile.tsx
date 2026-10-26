import React, { useState } from 'react';
import { Lock, PenLine, Upload } from 'lucide-react';
import { useStore } from '../lib/store';
import { ownSignature } from '../lib/access';
import { TopShell } from '../ui/Shell';
import { Avatar, Badge, Button, Card, Field, Input, Modal, TextLink } from '../ui/kit';
import { SignaturePad } from '../ui/SignaturePad';
import { ModeOption } from './faculty/Onboarding';
import { toast } from '../lib/toast';
import { formatDate } from '../lib/pdfGenerator';

export function Profile() {
  const s = useStore();
  const me = s.currentUser;
  const sig = ownSignature(me, s.signatures);
  const held = s.designations.filter(d => d.holderId === me.id);
  const mode = s.prefs[me.id]?.approvalMode || 'swipe';
  const [padOpen, setPadOpen] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwError, setPwError] = useState('');

  const changePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    if (pw.next !== pw.confirm) {
      setPwError('The new passwords don’t match.');
      return;
    }
    const res = s.changePassword(pw.current, pw.next);
    if (!res.ok) {
      setPwError(res.error || 'Could not update the password.');
      return;
    }
    setPw({ current: '', next: '', confirm: '' });
    toast('success', 'Password updated');
  };

  return (
    <TopShell active="profile">
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-9">
        <h1 className="text-[34px] sm:text-[40px] font-extrabold tracking-[-0.02em] mb-6">Profile &amp; settings</h1>
        <div className="grid lg:grid-cols-[minmax(0,456px)_minmax(0,1fr)] gap-5 items-start">
          <div className="flex flex-col gap-5">
            <Card className="p-6">
              <div className="flex items-center gap-4">
                <Avatar name={me.name} size={64} tone={me.role === 'student' ? 'cyan' : 'ink'} />
                <div className="min-w-0">
                  <h2 className="text-[22px] font-extrabold truncate">{me.name}</h2>
                  <p className="text-mauve truncate">{me.email}</p>
                </div>
              </div>
              {me.role === 'student' ? (
                <dl className="mt-5 grid grid-cols-[110px_1fr] gap-y-2 text-[15px]">
                  <dt className="text-mauve">CMS ID</dt>
                  <dd className="font-bold">{me.registrationNumber}</dd>
                  <dt className="text-mauve">Programme</dt>
                  <dd className="font-bold">{me.semester || '—'}</dd>
                  <dt className="text-mauve">Department</dt>
                  <dd className="font-bold">{me.department}</dd>
                </dl>
              ) : (
                <>
                  <p className="mt-5 text-[13px] font-extrabold tracking-[0.08em] text-mauve">DESIGNATIONS</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {held.length === 0 && <Badge>No designation assigned</Badge>}
                    {held.map(d => (
                      <React.Fragment key={d.id}>
                        <Badge tone="cyan" className="text-[15px] px-3 py-1.5">{d.title}</Badge>
                        <Badge className="text-[15px] px-3 py-1.5 text-ink">{d.department}</Badge>
                      </React.Fragment>
                    ))}
                  </div>
                  <p className="text-[15px] text-mauve mt-3">Designations are assigned by the administrator. Contact the registrar’s office if something is wrong.</p>
                </>
              )}
            </Card>

            <Card className="p-6">
              <h2 className="text-[22px] font-extrabold mb-4">Change password</h2>
              <form onSubmit={changePassword} className="flex flex-col gap-4">
                <Field label="Current password" htmlFor="pw-cur">
                  <Input id="pw-cur" type="password" autoComplete="current-password" value={pw.current} onChange={e => setPw(v => ({ ...v, current: e.target.value }))} />
                </Field>
                <Field label="New password" htmlFor="pw-new">
                  <Input id="pw-new" type="password" autoComplete="new-password" value={pw.next} onChange={e => setPw(v => ({ ...v, next: e.target.value }))} />
                </Field>
                <Field label="Confirm new password" htmlFor="pw-conf">
                  <Input id="pw-conf" type="password" autoComplete="new-password" value={pw.confirm} onChange={e => setPw(v => ({ ...v, confirm: e.target.value }))} />
                </Field>
                {pwError && <p role="alert" className="text-bad font-semibold">{pwError}</p>}
                <Button type="submit" size="lg" disabled={!pw.current || !pw.next}>
                  Update password
                </Button>
              </form>
              <p className="mt-4 text-[15px] text-mauve">
                Don’t know your current password? <TextLink to={`/reset?email=${encodeURIComponent(me.email)}`}>Reset it with an email code</TextLink>
              </p>
            </Card>
          </div>

          <div className="flex flex-col gap-5">
            <Card className="p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="text-[22px] font-extrabold">Saved signature</h2>
                <Badge tone="ok">
                  <Lock size={13} /> Encrypted
                </Badge>
              </div>
              <div className="checker relative rounded-[10px] border border-line h-[170px] flex items-center justify-center overflow-hidden">
                {sig ? <img src={sig.imageUrl} alt="Your saved signature" className="max-h-[130px] max-w-[80%] object-contain" /> : <p className="text-mauve font-semibold bg-white/80 px-3 py-1 rounded">No signature saved yet</p>}
                <span className="absolute left-3 bottom-3 bg-white rounded px-2 py-0.5 text-xs font-bold text-mauve">Transparent PNG</span>
              </div>
              <p className="text-[15px] text-mauve mt-4">
                {sig ? `Last updated ${formatDate(sig.createdAt)}. ` : ''}
                {me.role === 'student'
                  ? 'Placed in the Student block on forms that need your signature.'
                  : 'Stamped automatically onto your designated block when you approve. Each use is written to the audit log.'}
              </p>
              <div className="flex flex-wrap gap-2.5 mt-4">
                <Button onClick={() => setPadOpen(true)}>
                  <PenLine size={17} /> {sig ? 'Redraw' : 'Draw signature'}
                </Button>
                <Button variant="outline" onClick={() => setPadOpen(true)}>
                  <Upload size={17} /> Upload new PNG
                </Button>
              </div>
            </Card>

            {me.role === 'staff' && (
              <Card className="p-6">
                <h2 className="text-[22px] font-extrabold">Approval interface</h2>
                <p className="text-mauve mt-1 mb-4">How requests appear on your phone. You can switch anytime.</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <ModeOption mode="swipe" selected={mode === 'swipe'} onSelect={() => s.setPrefs(me.id, { approvalMode: 'swipe', tutorialSeen: true })} />
                  <ModeOption mode="button" selected={mode === 'button'} onSelect={() => s.setPrefs(me.id, { approvalMode: 'button', tutorialSeen: true })} />
                </div>
                <p className="mt-4 font-bold text-ok" aria-live="polite">
                  Saved: {mode === 'swipe' ? 'Swipe' : 'Button'} mode is on.
                </p>
              </Card>
            )}
          </div>
        </div>
      </div>
      <Modal open={padOpen} onClose={() => setPadOpen(false)} title={sig ? 'Update your signature' : 'Add your signature'}>
        <SignaturePad
          onSave={(url, src) => {
            s.saveOwnSignature(url, src);
            setPadOpen(false);
            toast('success', 'Signature saved');
          }}
        />
      </Modal>
    </TopShell>
  );
}

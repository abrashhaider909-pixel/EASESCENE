import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Lock } from 'lucide-react';
import { useStore, ApprovalMode } from '../../lib/store';
import { ownSignature } from '../../lib/access';
import { Button, Logo, cx } from '../../ui/kit';
import { SignaturePad } from '../../ui/SignaturePad';
import { navigate } from '../../ui/router';
import { toast } from '../../lib/toast';

function PhoneFrame({ step, back, children }: { step: number; back?: () => void; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-blush flex justify-center">
      <div className="w-full max-w-[440px] px-6 pt-6 pb-8 flex flex-col">
        <div className="flex items-center justify-between h-11">
          {back ? (
            <button aria-label="Back" onClick={back} className="w-11 h-11 -ml-2 inline-flex items-center justify-center rounded-full hover:bg-white/60">
              <ArrowLeft size={22} />
            </button>
          ) : (
            <span className="w-11" />
          )}
          <Logo className="text-[22px]" />
          <span className="text-sm font-bold text-mauve">Step {step} of 3</span>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-5 mb-6" aria-hidden>
          {[1, 2, 3].map(n => (
            <div key={n} className={cx('h-1 rounded-full', n < step ? 'bg-ink' : n === step ? 'bg-cyan' : 'bg-line')} />
          ))}
        </div>
        {children}
      </div>
    </div>
  );
}

export function SignatureOnboarding() {
  const s = useStore();
  const me = s.currentUser;
  const has = Boolean(ownSignature(me, s.signatures));
  return (
    <PhoneFrame step={2} back={() => navigate('/inbox')}>
      <h1 className="text-[30px] leading-tight font-extrabold">{has ? 'Update your signature' : 'Add your signature'}</h1>
      <p className="mt-2 text-[17px] text-mauve mb-6">It’s stamped onto documents you approve. Saved encrypted to your profile, and only you can use it.</p>
      <SignaturePad
        compact
        onSave={(url, src) => {
          s.saveOwnSignature(url, src);
          toast('success', 'Signature saved', 'It will be stamped on every document you approve.');
          navigate(s.prefs[me.id]?.tutorialSeen ? '/inbox' : '/onboarding/mode', true);
        }}
      />
      <p className="flex items-start gap-2 text-sm text-mauve mt-4">
        <Lock size={16} className="shrink-0 mt-0.5" /> Every use of your signature is logged with a timestamp.
      </p>
      <button
        className="mt-4 min-h-11 font-bold"
        onClick={() => {
          s.setPrefs(me.id, { signatureSkipped: true });
          navigate(s.prefs[me.id]?.tutorialSeen ? '/inbox' : '/onboarding/mode', true);
        }}
      >
        I’ll do this later
      </button>
    </PhoneFrame>
  );
}

export function ModePreview({ mode }: { mode: ApprovalMode }) {
  if (mode === 'swipe') {
    return (
      <div className="relative h-[124px] bg-mist rounded-[10px] overflow-hidden flex items-center justify-between px-3.5">
        <span className="text-bad font-bold text-sm">← Reject</span>
        <div className="relative w-[110px] h-[96px]">
          <div className="absolute inset-0 bg-white rounded-[8px] shadow rotate-[-6deg]" />
          <div className="absolute inset-0 bg-white rounded-[8px] shadow-md rotate-[8deg] p-3 flex flex-col gap-1.5">
            <div className="h-1.5 w-3/4 bg-mist rounded" />
            <div className="h-1.5 w-full bg-mist rounded" />
            <div className="h-1.5 w-2/3 bg-mist rounded" />
            <div className="mt-auto self-start border-2 border-ink rounded px-1.5 text-[10px] font-extrabold rotate-[10deg]">APPROVE</div>
          </div>
        </div>
        <span className="text-ok font-bold text-sm">Approve →</span>
      </div>
    );
  }
  return (
    <div className="h-[124px] bg-mist rounded-[10px] p-3 flex flex-col gap-2">
      <div className="flex-1 bg-white rounded-[6px] p-2.5 flex flex-col gap-1.5">
        <div className="h-1.5 w-1/2 bg-mist rounded" />
        <div className="h-1.5 w-full bg-mist rounded" />
        <div className="h-1.5 w-4/5 bg-mist rounded" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <span className="h-7 rounded-[5px] border-2 border-bad text-bad text-xs font-bold inline-flex items-center justify-center">Reject</span>
        <span className="h-7 rounded-[5px] bg-ink text-cyan text-xs font-bold inline-flex items-center justify-center">Approve & sign</span>
      </div>
    </div>
  );
}

export function ModeOption({ mode, selected, onSelect, fastest }: { mode: ApprovalMode; selected: boolean; onSelect: () => void; fastest?: boolean }) {
  const copy =
    mode === 'swipe'
      ? { title: 'Swipe mode', text: 'Swipe right to approve and stamp your signature. Swipe left to reject with a reason.' }
      : { title: 'Button mode', text: 'Read the whole document, then tap Approve or Reject at the bottom of the screen.' };
  return (
    <label className={cx('block rounded-[12px] p-4 cursor-pointer border-2', selected ? 'border-ink bg-white' : 'border-line bg-paper hover:border-mauve')}>
      <span className="flex items-center gap-3 mb-3">
        <input type="radio" name="approval-mode" checked={selected} onChange={onSelect} className="w-[22px] h-[22px] accent-ink" />
        <span className="text-[19px] font-extrabold flex-1">{copy.title}</span>
        {fastest && <span className="bg-ink text-cyan text-[11px] font-extrabold rounded-full px-2.5 py-1">FASTEST</span>}
      </span>
      <ModePreview mode={mode} />
      <span className="block mt-3 text-[15px] text-mauve">{copy.text}</span>
    </label>
  );
}

export function ApprovalModeChooser() {
  const s = useStore();
  const me = s.currentUser;
  const [mode, setMode] = useState<ApprovalMode>(s.prefs[me.id]?.approvalMode || 'swipe');
  const done = () => {
    s.setPrefs(me.id, { approvalMode: mode, tutorialSeen: true });
    toast('success', `${mode === 'swipe' ? 'Swipe' : 'Button'} mode is on`, 'Change it anytime in Profile.');
    navigate('/inbox', true);
  };
  return (
    <PhoneFrame step={3} back={() => navigate('/onboarding/signature')}>
      <h1 className="text-[30px] leading-tight font-extrabold">How do you want to approve?</h1>
      <p className="mt-2 text-[17px] text-mauve mb-6">Pick what feels natural. You can switch anytime in Settings.</p>
      <div className="flex flex-col gap-4">
        <ModeOption mode="swipe" selected={mode === 'swipe'} onSelect={() => setMode('swipe')} fastest />
        <ModeOption mode="button" selected={mode === 'button'} onSelect={() => setMode('button')} />
      </div>
      <Button size="lg" className="w-full mt-6" onClick={done}>
        Continue with {mode === 'swipe' ? 'Swipe' : 'Button'} mode <ArrowRight size={18} />
      </Button>
      <p className="text-center mt-3 font-bold">Change later in Settings</p>
    </PhoneFrame>
  );
}

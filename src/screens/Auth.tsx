import React, { useEffect, useMemo, useRef, useState } from 'react';
import { IdCard, Mail, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { useStore, EzStore } from '../lib/store';
import { ownSignature } from '../lib/access';
import { PROGRAMMES } from '../lib/constants';
import { Button, Card, Checkbox, Field, Input, Logo, Segmented, Select, TextLink, cx } from '../ui/kit';
import { navigate, routeQuery } from '../ui/router';
import { toast } from '../lib/toast';
import { UserProfile } from '../types';
import { DEMO_MODE } from '../config';

type Role = 'student' | 'staff' | 'admin';

export function homeFor(user: UserProfile): string {
  const st = EzStore.getState();
  if (user.role === 'admin') return '/admin/designations';
  if (user.role === 'student') return '/new';
  const prefs = st.prefs[user.id] || {};
  if (!ownSignature(user, st.signatures) && !prefs.signatureSkipped) return '/onboarding/signature';
  if (!prefs.tutorialSeen) return '/onboarding/mode';
  return '/inbox';
}

function AuthAside() {
  const items = [
    { icon: IdCard, title: 'Students', text: 'University email, CMS ID and your password' },
    { icon: Mail, title: 'Faculty & authorities', text: 'Official university email and password' },
    { icon: ShieldCheck, title: 'Administrators', text: 'Official email, password and admin rights' }
  ];
  return (
    <aside className="bg-ink text-white lg:w-[620px] shrink-0 px-6 sm:px-16 py-10 lg:py-[70px] flex flex-col justify-between gap-10">
      <div>
        <Logo light className="text-[44px] sm:text-[48px]" />
        <h1 className="mt-5 text-[28px] sm:text-[34px] font-extrabold leading-tight">One sign-in, three portals.</h1>
        <p className="mt-3 text-[17px] text-white/75 max-w-md">Choose who you are and EzScene opens the right workspace.</p>
        <ul className="mt-8 hidden sm:flex flex-col gap-5">
          {items.map(i => (
            <li key={i.title} className="flex gap-4">
              <span className="w-10 h-10 rounded-[8px] bg-cyan text-ink inline-flex items-center justify-center shrink-0">
                <i.icon size={20} />
              </span>
              <span>
                <span className="block font-bold text-[17px]">{i.title}</span>
                <span className="block text-white/75">{i.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p className="hidden lg:block text-sm text-white/60 max-w-md">Forgotten passwords are reset with a one-time code sent to your university email.</p>
    </aside>
  );
}

export function Login() {
  const s = useStore();
  const params = routeQuery();
  const [role, setRole] = useState<Role>((params.get('role') as Role) || 'student');
  const [email, setEmail] = useState('');
  const [cms, setCms] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [keep, setKeep] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => setError(''), [role]);
  const subtitle = { student: 'Student portal: forms, uploads and request tracking.', staff: 'Faculty portal: review and sign requests.', admin: 'Admin console: designations, templates and audit.' }[role];
  const cta = { student: 'Log in as student', staff: 'Log in as faculty', admin: 'Log in as admin' }[role];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (role === 'student' && !cms.trim()) {
      setError('Enter your CMS ID.');
      return;
    }
    setBusy(true);
    const res = await s.authenticate(email, password, { role, cmsId: role === 'student' ? cms : undefined, keepLoggedIn: keep });
    setBusy(false);
    if (!res.ok || !res.user) {
      setError(res.error || 'Could not log in.');
      return;
    }
    const next = params.get('next');
    navigate(next === 'requests' && res.user.role === 'student' ? '/requests' : homeFor(res.user), true);
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <AuthAside />
      <main className="flex-1 bg-blush flex items-center justify-center px-4 py-10">
        <Card className="w-full max-w-[460px] p-6 sm:p-8 rounded-[16px]">
          <h2 className="text-[30px] font-extrabold">Log in</h2>
          <p className="text-mauve mt-1 mb-5">{subtitle}</p>
          <Segmented
            label="Portal"
            value={role}
            onChange={setRole}
            options={[
              { value: 'student', label: 'Student' },
              { value: 'staff', label: 'Faculty' },
              { value: 'admin', label: 'Admin' }
            ]}
          />
          <form onSubmit={submit} className="mt-6 flex flex-col gap-5" noValidate>
            <Field label={role === 'student' ? 'University email' : 'Official email'} htmlFor="email">
              <Input id="email" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} placeholder={role === 'student' ? 'name@student.uni.edu.pk' : 'name@uni.edu.pk'} />
            </Field>
            {role === 'student' && (
              <Field label="CMS ID" htmlFor="cms">
                <Input id="cms" inputMode="numeric" value={cms} onChange={e => setCms(e.target.value.replace(/\D/g, ''))} placeholder="e.g. 412345" />
              </Field>
            )}
            <Field label="Password" htmlFor="password" right={<TextLink to={`/reset?email=${encodeURIComponent(email)}`} className="text-sm">Forgot password?</TextLink>}>
              <div className="relative">
                <Input id="password" type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className="pr-12" />
                <button type="button" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow(v => !v)} className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 inline-flex items-center justify-center text-mauve">
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </Field>
            <Checkbox id="keep" checked={keep} onChange={setKeep} label="Keep me logged in on this device" />
            {error && (
              <p role="alert" className="rounded-[8px] bg-badbg text-bad font-semibold px-3 py-2.5">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" loading={busy} className="w-full">
              {cta}
            </Button>
          </form>
          {role === 'student' ? (
            <p className="text-center mt-5 text-mauve">
              New here? <TextLink to="/signup">Create a student account</TextLink>
            </p>
          ) : (
            <p className="text-center mt-5 text-sm text-mauve">Faculty and admin accounts are issued by the registrar’s office.</p>
          )}
          {DEMO_MODE && (
            <p className="text-center mt-3 text-sm text-mauve">
              Just exploring? <TextLink to="/">Use a one-click demo account</TextLink>
            </p>
          )}
        </Card>
      </main>
    </div>
  );
}

export function Signup() {
  const s = useStore();
  const [f, setF] = useState({ name: '', email: '', cmsId: '', programme: PROGRAMMES[0], password: '', confirm: '' });
  const [error, setError] = useState('');
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF(v => ({ ...v, [k]: e.target.value }));
  const department = useMemo(() => {
    if (/Electrical/i.test(f.programme)) return 'Electrical Engineering';
    if (/Computer/i.test(f.programme)) return 'Computer Science';
    if (/Mechanical/i.test(f.programme)) return 'Mechanical Engineering';
    return 'Electrical Engineering';
  }, [f.programme]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (f.password !== f.confirm) {
      setError('Passwords don’t match.');
      return;
    }
    const res = s.registerStudent({ name: f.name, email: f.email, cmsId: f.cmsId, programme: f.programme, department, password: f.password });
    if (!res.ok) {
      setError(res.error || 'Could not create the account.');
      return;
    }
    toast('success', 'Welcome to EzScene', 'Your student account is ready.');
    navigate('/new', true);
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <AuthAside />
      <main className="flex-1 bg-blush flex items-center justify-center px-4 py-10">
        <Card className="w-full max-w-[460px] p-6 sm:p-8 rounded-[16px]">
          <h2 className="text-[30px] font-extrabold">Create a student account</h2>
          <p className="text-mauve mt-1 mb-6">Use your university email and CMS ID.</p>
          <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            <Field label="Full name" htmlFor="su-name">
              <Input id="su-name" autoComplete="name" value={f.name} onChange={set('name')} />
            </Field>
            <Field label="University email" htmlFor="su-email">
              <Input id="su-email" type="email" autoComplete="email" value={f.email} onChange={set('email')} placeholder="name@student.uni.edu.pk" />
            </Field>
            <Field label="CMS ID" htmlFor="su-cms">
              <Input id="su-cms" inputMode="numeric" value={f.cmsId} onChange={e => setF(v => ({ ...v, cmsId: e.target.value.replace(/\D/g, '') }))} />
            </Field>
            <Field label="Programme & section" htmlFor="su-prog">
              <Select id="su-prog" value={f.programme} onChange={set('programme')}>
                {PROGRAMMES.map(p => (
                  <option key={p}>{p}</option>
                ))}
              </Select>
            </Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Password" htmlFor="su-pw">
                <Input id="su-pw" type="password" autoComplete="new-password" value={f.password} onChange={set('password')} />
              </Field>
              <Field label="Confirm" htmlFor="su-pw2">
                <Input id="su-pw2" type="password" autoComplete="new-password" value={f.confirm} onChange={set('confirm')} />
              </Field>
            </div>
            {error && (
              <p role="alert" className="rounded-[8px] bg-badbg text-bad font-semibold px-3 py-2.5">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" className="w-full mt-1">
              Create account
            </Button>
          </form>
          <p className="text-center mt-5 text-mauve">
            Already registered? <TextLink to="/login?role=student">Log in</TextLink>
          </p>
        </Card>
      </main>
    </div>
  );
}

/* ------------------------------------------------------- password reset */

function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || '');
  const setAt = (i: number, d: string) => {
    const arr = digits.slice();
    arr[i] = d;
    onChange(arr.join('').slice(0, 6));
  };
  return (
    <div className="grid grid-cols-6 gap-2 sm:gap-3" role="group" aria-label="One-time code">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={el => {
            refs.current[i] = el;
          }}
          aria-label={`Digit ${i + 1}`}
          inputMode="numeric"
          maxLength={1}
          value={d}
          onChange={e => {
            const v = e.target.value.replace(/\D/g, '');
            if (v.length > 1) {
              onChange(v.slice(0, 6));
              refs.current[Math.min(5, v.length - 1)]?.focus();
              return;
            }
            setAt(i, v);
            if (v && i < 5) refs.current[i + 1]?.focus();
          }}
          onKeyDown={e => {
            if (e.key === 'Backspace' && !d && i > 0) refs.current[i - 1]?.focus();
          }}
          onPaste={e => {
            const v = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
            if (v) {
              e.preventDefault();
              onChange(v);
              refs.current[Math.min(5, v.length - 1)]?.focus();
            }
          }}
          className={cx('h-14 sm:h-[60px] w-full text-center text-[26px] font-bold rounded-[8px] border focus:outline-none', d ? 'border-ink' : 'border-line', 'focus:border-cyan focus:bg-skylight focus:border-2')}
        />
      ))}
    </div>
  );
}

export function ResetPassword() {
  const s = useStore();
  const params = routeQuery();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [email, setEmail] = useState(params.get('email') || '');
  const [masked, setMasked] = useState('');
  const [deliveredCode, setDeliveredCode] = useState('');
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const send = (e?: React.FormEvent) => {
    e?.preventDefault();
    setError('');
    const res = s.requestPasswordReset(email);
    if (!res.ok) {
      setError(res.error || 'Could not send a code.');
      return;
    }
    setMasked(res.masked!);
    setDeliveredCode(res.code!);
    setCode('');
    setCooldown(60);
    setStep(2);
  };

  const verify = (e: React.FormEvent) => {
    e.preventDefault();
    const res = s.verifyResetCode(email, code);
    if (!res.ok) {
      setError(res.error || 'Invalid code');
      return;
    }
    setError('');
    setStep(3);
  };

  const finish = (e: React.FormEvent) => {
    e.preventDefault();
    if (pw !== pw2) {
      setError('Passwords don’t match.');
      return;
    }
    const res = s.completePasswordReset(email, pw);
    if (!res.ok) {
      setError(res.error || 'Could not reset the password.');
      return;
    }
    setError('');
    setStep(4);
  };

  const steps = ['Email', 'Verify code', 'New password'];
  return (
    <div className="min-h-screen bg-blush flex flex-col items-center px-4 py-10">
      <Logo className="text-[44px]" />
      <Card className="w-full max-w-[520px] mt-6 p-6 sm:p-8 rounded-[16px]">
        <ol className="grid grid-cols-3 gap-2 mb-7" aria-label="Progress">
          {steps.map((label, i) => {
            const n = i + 1;
            const done = step > n;
            const cur = step === n;
            return (
              <li key={label} aria-current={cur ? 'step' : undefined}>
                <div className={cx('h-[5px] rounded-full', done ? 'bg-ink' : cur ? 'bg-cyan' : 'bg-mist')} />
                <p className={cx('mt-2 text-[13px] font-bold', done || cur ? 'text-ink' : 'text-mauve')}>
                  {n} · {label}
                </p>
              </li>
            );
          })}
        </ol>

        {step === 1 && (
          <form onSubmit={send} className="flex flex-col gap-5">
            <div>
              <h1 className="text-[26px] font-extrabold">Reset your password</h1>
              <p className="text-mauve mt-1">Enter your university email and we’ll send a 6-digit code.</p>
            </div>
            <Field label="University email" htmlFor="reset-email">
              <Input id="reset-email" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
            </Field>
            {error && <p role="alert" className="text-bad font-semibold">{error}</p>}
            <Button type="submit" size="lg">Send code</Button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={verify} className="flex flex-col gap-5">
            <div>
              <h1 className="text-[26px] font-extrabold">Check your inbox</h1>
              <p className="text-mauve mt-1">
                We sent a 6-digit code to <strong className="text-ink">{masked}</strong>. It expires in 10 minutes.
              </p>
            </div>
            <div className="rounded-[10px] bg-skylight border border-sky px-3.5 py-2.5 text-sm">
              <strong>Email delivery isn’t connected in this deployment.</strong> Your code is <span className="font-mono font-bold tracking-widest">{deliveredCode}</span>. Connect an email service to send it for real (see SETUP.md).
            </div>
            <Field label="One-time code">
              <OtpInput value={code} onChange={setCode} />
            </Field>
            <div className="flex items-center justify-between text-sm">
              <span className="text-mauve">{cooldown > 0 ? `Resend available in 0:${String(cooldown).padStart(2, '0')}` : 'Didn’t get it?'}</span>
              <button type="button" onClick={() => send()} disabled={cooldown > 0} className="font-bold text-teal disabled:text-mauve/70">
                Resend code
              </button>
            </div>
            {error && <p role="alert" className="text-bad font-semibold">{error}</p>}
            <Button type="submit" size="lg" disabled={code.length !== 6}>
              Verify code
            </Button>
            <button type="button" onClick={() => { setStep(1); setError(''); }} className="font-bold text-ink">
              Use a different email
            </button>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={finish} className="flex flex-col gap-5">
            <div>
              <h1 className="text-[26px] font-extrabold">Choose a new password</h1>
              <p className="text-mauve mt-1">At least 6 characters.</p>
            </div>
            <Field label="New password" htmlFor="np1">
              <Input id="np1" type="password" autoComplete="new-password" value={pw} onChange={e => setPw(e.target.value)} />
            </Field>
            <Field label="Confirm new password" htmlFor="np2">
              <Input id="np2" type="password" autoComplete="new-password" value={pw2} onChange={e => setPw2(e.target.value)} />
            </Field>
            {error && <p role="alert" className="text-bad font-semibold">{error}</p>}
            <Button type="submit" size="lg">Update password</Button>
          </form>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-4 text-center items-center py-4">
            <span className="w-14 h-14 rounded-full bg-ok text-white inline-flex items-center justify-center text-2xl">✓</span>
            <h1 className="text-[26px] font-extrabold">Password updated</h1>
            <p className="text-mauve">You can now log in with your new password.</p>
            <Button size="lg" onClick={() => navigate('/login', true)} className="w-full">
              Back to log in
            </Button>
          </div>
        )}
      </Card>
      <p className="mt-6">
        <TextLink to="/login">← Back to log in</TextLink>
      </p>
    </div>
  );
}

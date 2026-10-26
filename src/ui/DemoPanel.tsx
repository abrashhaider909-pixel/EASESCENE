import { GraduationCap, PenLine, Stamp, ShieldCheck, ArrowRight } from 'lucide-react';
import { useStore } from '../lib/store';
import { homeFor } from '../screens/Auth';
import { navigate } from './router';
import { toast } from '../lib/toast';
import { cx } from './kit';

const PERSONAS = [
  { id: 'student-hamza', icon: GraduationCap, role: 'Student', name: 'Hamza Tariq', try: 'Fill a Leave Request or upload a PDF, edit the suggested signers, then track it live.' },
  { id: 'staff-sana', icon: PenLine, role: 'Course Advisor', name: 'Dr. Sana Javed', try: 'Approve the request you just sent. Her saved signature is stamped automatically.' },
  { id: 'staff-ayesha', icon: Stamp, role: 'Head of Department', name: 'Dr. Ayesha Malik', try: '4 requests waiting. Approve, reject with a reason, or ask for changes. Try “Review on phone”.' },
  { id: 'admin-registrar', icon: ShieldCheck, role: 'Administrator', name: "Registrar's office", try: 'Reassign a designation, edit a template, verify EZ-2026-0398 in the audit log.' }
];

export function DemoPanel({ compact = false }: { compact?: boolean }) {
  const s = useStore();
  const signIn = (id: string) => {
    const user = s.demoSignIn(id);
    if (!user) {
      toast('error', 'That demo account isn’t available', 'Reset the demo data from the About page.');
      return;
    }
    navigate(homeFor(user), true);
  };
  return (
    <section aria-labelledby="demo-h" className={cx('rounded-[20px] border-2 border-ink bg-white', compact ? 'p-5' : 'p-6 sm:p-8')}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[12px] font-extrabold tracking-[0.12em] text-teal">TRY IT IN ONE CLICK</p>
          <h2 id="demo-h" className="text-[24px] sm:text-[26px] font-extrabold mt-1">
            Walk one request through every desk
          </h2>
          <p className="text-mauve mt-1 max-w-2xl">Sign in as each person below in order. The demo runs on sample data in your browser, so nothing you do here affects anyone else.</p>
        </div>
        <a href="#/about" className="font-bold text-teal">How it works →</a>
      </div>
      <ol className="grid gap-3 mt-5 sm:grid-cols-2 lg:grid-cols-4">
        {PERSONAS.map((p, i) => (
          <li key={p.id} className="min-w-0">
            <button onClick={() => signIn(p.id)} className="group w-full h-full text-left rounded-[14px] bg-paper border border-line p-4 flex flex-col gap-2 hover:border-ink transition-colors">
              <span className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-[8px] bg-ink text-cyan inline-flex items-center justify-center shrink-0">
                  <p.icon size={18} />
                </span>
                <span className="text-[13px] font-extrabold text-mauve">Step {i + 1}</span>
              </span>
              <span>
                <span className="block font-extrabold text-[17px]">{p.role}</span>
                <span className="block text-[14px] text-mauve">{p.name}</span>
              </span>
              <span className="text-[14px] flex-1">{p.try}</span>
              <span className="inline-flex items-center gap-1.5 font-bold text-teal">
                Sign in <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
              </span>
            </button>
          </li>
        ))}
      </ol>
      <p className="text-sm text-mauve mt-4">Every demo account also works on the log-in page with password <code className="font-bold text-ink">123</code>. Students also enter their CMS ID (Hamza: 412345).</p>
    </section>
  );
}

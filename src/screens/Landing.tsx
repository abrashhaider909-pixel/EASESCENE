import { ArrowRight, GraduationCap, PenLine, ShieldCheck } from 'lucide-react';
import { LinkButton, Logo } from '../ui/kit';
import { UNIVERSITY_NAME, SUPPORT_EMAIL, DEMO_MODE, REPO_URL, LICENSE_NAME } from '../config';
import { DemoPanel } from '../ui/DemoPanel';
import { useStore } from '../lib/store';

function Squiggle({ d }: { d: string }) {
  return (
    <svg width="120" height="46" viewBox="0 0 120 46" fill="none" stroke="#1B2A6B" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export function Landing() {
  const s = useStore();
  const home = s.isAuthenticated ? (s.currentUser.role === 'student' ? '/new' : s.currentUser.role === 'staff' ? '/inbox' : '/admin/designations') : null;
  const portals = [
    { icon: GraduationCap, title: 'Students', text: 'Log in with university email, CMS ID and password. Fill forms, upload documents and see whose desk your request is on.', cta: 'Student login', role: 'student' },
    { icon: PenLine, title: 'Faculty & authorities', text: 'Review requests on your phone. Swipe or tap to approve, and your saved signature is stamped in the right place automatically.', cta: 'Faculty login', role: 'staff' },
    { icon: ShieldCheck, title: 'Administrators', text: 'Map designations to people as leadership changes, manage form templates and verify every signature in the audit log.', cta: 'Admin login', role: 'admin' }
  ];
  return (
    <div className="min-h-screen bg-blush">
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-12 py-[18px]">
        <Logo className="text-[30px]" />
        <nav aria-label="Account" className="flex flex-wrap items-center gap-2">
          <a href="#/about" className="hidden sm:inline-flex items-center min-h-11 px-3 text-[16px] font-semibold no-underline">
            About
          </a>
          {home ? (
            <LinkButton to={home} variant="cyan">
              Open my workspace
            </LinkButton>
          ) : (
            <>
              <a href="#/login" className="inline-flex items-center min-h-11 px-3.5 text-[16px] font-semibold no-underline">
                Log in
              </a>
              <LinkButton to="/signup" variant="cyan">
                Create account
              </LinkButton>
            </>
          )}
        </nav>
      </header>

      <main className="max-w-[1180px] mx-auto px-4 sm:px-12 pt-6 pb-16">
        <section className="flex flex-wrap items-center gap-14">
          <div className="flex-[1_1_460px] min-w-0">
            <p className="inline-block mb-5 px-3 py-1.5 bg-white border border-line rounded-full text-[13px] font-bold tracking-[0.04em] uppercase text-mauve">Students · Faculty · Admin</p>
            <h1 className="m-0 text-[40px] sm:text-[60px] leading-[1.06] font-extrabold tracking-[-0.02em]">
              Get documents approved &amp; signed effortlessly with <span className="font-normal tracking-normal" style={{ fontFamily: 'var(--font-script)' }}>EzScene</span>
            </h1>
            <p className="mt-5 max-w-[520px] text-[19px] leading-[1.55] text-mauve">
              Fill NOCs, leave requests and clearances online. EzScene sends them to the right desks in the right order and hands back a stamped, print-ready PDF. No printing, no chasing signatures.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <LinkButton to={s.isAuthenticated && s.currentUser.role === 'student' ? '/new' : '/login?role=student'} size="lg">
                Create application <ArrowRight size={20} />
              </LinkButton>
              <LinkButton to={s.isAuthenticated && s.currentUser.role === 'student' ? '/requests' : '/login?role=student&next=requests'} size="lg" variant="outline" className="bg-transparent">
                Track a request
              </LinkButton>
            </div>
          </div>

          <div aria-hidden="true" className="flex-[1_1_380px] min-w-0 flex justify-center">
            <div className="relative w-full max-w-[420px] h-[470px]">
              <div className="absolute left-[34px] top-[26px] right-0 bottom-0 bg-sky rounded-[18px] rotate-[4deg]" />
              <div className="absolute left-0 top-0 right-[30px] bottom-[24px] bg-white rounded-[14px] shadow-[0_18px_40px_rgba(60,30,40,0.16)] px-7 py-[30px] flex flex-col gap-3 -rotate-2">
                <div className="text-[11px] font-extrabold tracking-[0.14em] text-mauve">LEAVE APPLICATION</div>
                <div className="h-2.5 w-[70%] bg-[#EDE3E6] rounded" />
                <div className="h-2 w-full bg-mist rounded" />
                <div className="h-2 w-[92%] bg-mist rounded" />
                <div className="h-2 w-[96%] bg-mist rounded" />
                <div className="h-2 w-[60%] bg-mist rounded" />
                <div className="absolute right-6 top-[60px] rotate-[-14deg] border-[3px] border-teal text-teal rounded-[8px] px-3 py-1 text-[20px] font-extrabold tracking-[0.12em]">APPROVED</div>
                <div className="flex gap-4 mt-auto">
                  <div className="flex-1 min-w-0">
                    <Squiggle d="M4 34c8-20 16-28 18-16 2 12-6 18 2 10s10-20 16-12-2 16 6 10 8-14 14-8 0 10 8 6 10-10 16-8 8 4 14 2 10-4 18-6" />
                    <div className="border-t-[1.5px] border-ink pt-1.5 text-[11px] font-bold">Course Advisor</div>
                    <div className="text-[10px] text-ok font-bold">Signed 26 Oct · 11:02</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <Squiggle d="M6 30c6-6 10-22 16-20s-8 24 0 22 12-18 20-14-4 12 4 12 10-12 18-10 4 8 12 6 12-10 20-10 10 2 16 0" />
                    <div className="border-t-[1.5px] border-ink pt-1.5 text-[11px] font-bold">Head of Department</div>
                    <div className="text-[10px] text-ok font-bold">Signed 26 Oct · 15:40</div>
                  </div>
                </div>
              </div>
              <div className="absolute left-0 bottom-0 bg-ink text-white rounded-[8px] px-4 py-2.5 text-[13px] font-bold flex items-center gap-2.5 shadow-lg">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan pulse-ring" /> Now on the Dean's desk
              </div>
            </div>
          </div>
        </section>

        {DEMO_MODE && !s.isAuthenticated && (
          <div className="mt-14">
            <DemoPanel />
          </div>
        )}

        <section aria-labelledby="portals" className="mt-[72px]">
          <h2 id="portals" className="mb-5 text-[26px] font-extrabold tracking-[-0.01em]">
            Pick your portal
          </h2>
          <div className="flex flex-wrap gap-4">
            {portals.map(p => (
              <a key={p.role} href={`#/login?role=${p.role}`} className="flex-[1_1_280px] min-w-0 flex flex-col gap-2.5 p-6 bg-white border border-line rounded-[16px] no-underline hover:border-ink transition-colors">
                <span className="inline-flex items-center justify-center w-11 h-11 bg-ink text-cyan rounded-[10px]">
                  <p.icon size={22} />
                </span>
                <span className="text-[20px] font-extrabold">{p.title}</span>
                <span className="text-[15px] leading-[1.5] text-mauve">{p.text}</span>
                <span className="mt-1 text-[15px] font-bold text-teal">{p.cta} →</span>
              </a>
            ))}
          </div>
        </section>

        <section aria-labelledby="how" className="mt-16 p-8 bg-ink text-white rounded-[20px]">
          <h2 id="how" className="mb-6 text-[26px] font-extrabold">
            How it works
          </h2>
          <ol className="list-none m-0 p-0 flex flex-wrap gap-6">
            {[
              ['01', 'Fill or upload', 'Pick a university form and fill it in the browser, or upload your own PDF or Word file.'],
              ['02', 'Check the approval chain', 'Smart scan reads the document and suggests who signs, e.g. Advisor → HoD → Dean. Edit it before sending.'],
              ['03', 'Download the signed PDF', 'Track each desk in real time, then download a stamped, print-ready copy with a verifiable ID.']
            ].map(([n, t, d]) => (
              <li key={n} className="flex-[1_1_240px] min-w-0 flex flex-col gap-2">
                <span className="text-[14px] font-extrabold text-cyan">{n}</span>
                <span className="text-[19px] font-bold">{t}</span>
                <span className="text-[15px] leading-[1.5] text-[#CFC3C8]">{d}</span>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="border-t border-line px-4 sm:px-12 py-6 flex flex-wrap justify-between gap-3 text-[15px] text-mauve">
        <span>
          <span style={{ fontFamily: 'var(--font-script)' }} className="text-ink">
            EzScene
          </span>{' '}
          · digital approvals for {UNIVERSITY_NAME}
        </span>
        <span className="flex flex-wrap gap-4">
          <a href="#/verify" className="font-bold text-teal">
            Verify a document
          </a>
          <a href="#/about">About</a>
          {REPO_URL ? (
            <a href={REPO_URL} target="_blank" rel="noopener">
              Source code · {LICENSE_NAME}
            </a>
          ) : (
            <span>Open source · {LICENSE_NAME}</span>
          )}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </span>
      </footer>
    </div>
  );
}

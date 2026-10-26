import { useState } from 'react';
import { ArrowRight, Github, Scale, RotateCcw, ArrowDown } from 'lucide-react';
import { useStore, isCloudConfigured } from '../lib/store';
import { Button, Card, Logo, Modal, LinkButton } from '../ui/kit';
import { DemoPanel } from '../ui/DemoPanel';
import { DEMO_MODE, REPO_URL, LICENSE_NAME, UNIVERSITY_NAME } from '../config';
import { navigate } from '../ui/router';
import { toast } from '../lib/toast';

const FEATURES: [string, string][] = [
  ['Forms filled online', 'Six university forms with a live preview of the final document. Drafts are saved, and data from the student’s profile fills in automatically.'],
  ['Bring your own document', 'Upload a PDF or Word file. The original pages are kept and a signed approval sheet is added at the end.'],
  ['Suggested approval chain', 'A rule-based scan reads the form or the uploaded text and proposes who signs and in what order, with the reason for each step. The student can reorder, add or remove signers.'],
  ['Signing that lands in the right place', 'Each authority saves a signature once. Approving stamps it into that person’s block, plus the department seal for head-level roles.'],
  ['Live tracking', 'Students see whose desk a request is on and since when, get notified at each signature, and can send a reminder after 24 hours or withdraw.'],
  ['Review from a phone', 'Faculty can swipe right to approve or left to reject with a reason, or read the full document and tap a button.'],
  ['Leadership changes without lost files', 'When the admin reassigns a designation, pending requests move to the new holder; past signatures stay with whoever signed.'],
  ['Verifiable documents', 'Every PDF carries an ID, a QR code and a SHA-256 fingerprint. Anyone can check it by ID or by uploading the file.'],
  ['Tamper-evident audit log', 'Every submission, signature, rejection and admin change is hash-chained, so editing any past entry breaks the chain.']
];

const STACK = ['React 19 + TypeScript', 'Vite', 'Tailwind CSS 4', 'jsPDF + pdf-lib', 'qrcode', 'Supabase (optional)', 'Gemini via a server function (optional)', 'Vitest + Playwright'];

function Box({ title, lines, dark }: { title: string; lines: string[]; dark?: boolean }) {
  return (
    <div className={`rounded-[12px] border-2 border-ink p-3.5 min-w-0 ${dark ? 'bg-ink text-white' : 'bg-white'}`}>
      <p className={`font-extrabold ${dark ? 'text-cyan' : ''}`}>{title}</p>
      <ul className={`mt-1 text-[14px] ${dark ? 'text-white/80' : 'text-mauve'}`}>
        {lines.map(l => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </div>
  );
}

export function About() {
  const s = useStore();
  const [confirmReset, setConfirmReset] = useState(false);
  const canReset = !isCloudConfigured() || (s.isAuthenticated && s.currentUser.role === 'admin');
  return (
    <div className="min-h-screen bg-blush">
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-12 py-[18px]">
        <Logo className="text-[30px]" />
        <nav className="flex items-center gap-2">
          {REPO_URL && (
            <a href={REPO_URL} target="_blank" rel="noopener" className="inline-flex items-center gap-2 min-h-11 px-3 font-bold">
              <Github size={18} /> Source code
            </a>
          )}
          <LinkButton to={s.isAuthenticated ? '/' : '/login'} variant="cyan">
            {s.isAuthenticated ? 'Back to EzScene' : 'Log in'}
          </LinkButton>
        </nav>
      </header>

      <main className="max-w-[1080px] mx-auto px-4 sm:px-12 pb-16 flex flex-col gap-10">
        <section className="pt-4">
          <p className="text-[13px] font-extrabold tracking-[0.12em] text-teal">ABOUT THE PROJECT</p>
          <h1 className="text-[36px] sm:text-[48px] leading-[1.08] font-extrabold tracking-[-0.02em] mt-2 max-w-3xl">University paperwork, approved and signed without the corridor walk</h1>
          <p className="text-[18px] text-mauve mt-4 max-w-2xl">EzScene is an open-source approvals platform for {UNIVERSITY_NAME}. Students send leave requests, NOCs and clearances online; the right people sign in the right order; the student downloads a stamped PDF anyone can verify.</p>
        </section>

        <section className="grid md:grid-cols-2 gap-5" aria-label="Problem and users">
          <Card className="p-6">
            <h2 className="text-[22px] font-extrabold">The problem</h2>
            <p className="mt-2 text-[16px] leading-relaxed">
              A simple leave application at a Pakistani university often means printing a form, then walking it from the advisor to the head of department to the dean, waiting outside each office. Students can’t tell whose desk it is stuck on. Faculty sign stacks of paper. When a head of department changes, half-signed files get lost, and a stamped paper is easy to forge and hard to check.
            </p>
          </Card>
          <Card className="p-6">
            <h2 className="text-[22px] font-extrabold">Who it’s for</h2>
            <ul className="mt-2 text-[16px] leading-relaxed list-disc pl-5 space-y-1.5">
              <li><strong>Students</strong> who need documents approved and want to know where they are.</li>
              <li><strong>Faculty and authorities</strong> (advisors, HoDs, deans, registrar, wardens) who review and sign, often from a phone.</li>
              <li><strong>The registrar’s office</strong>, which maps roles to people, maintains forms and answers “is this document genuine?”.</li>
              <li><strong>Anyone receiving a document</strong>, such as an employer or embassy, who needs to verify it.</li>
            </ul>
          </Card>
        </section>

        {DEMO_MODE && <DemoPanel />}

        <section aria-labelledby="flow-h">
          <h2 id="flow-h" className="text-[26px] font-extrabold mb-4">How a request moves</h2>
          <ol className="grid gap-3 md:grid-cols-5">
            {[
              ['Fill or upload', 'Student picks a form or uploads a PDF/Word file.'],
              ['Check signers', 'The scan suggests the chain with reasons; the student edits it.'],
              ['Sign in order', 'Each desk approves with a saved signature, rejects, or asks for changes.'],
              ['Issue', 'After the last signature, the stamped PDF with QR and fingerprint is generated.'],
              ['Verify', 'Anyone checks the ID or uploads the PDF on the public page.']
            ].map(([t, d], i) => (
              <li key={t} className="rounded-[14px] bg-white border border-line p-4">
                <span className="text-[13px] font-extrabold text-teal">{i + 1}</span>
                <p className="font-extrabold mt-1">{t}</p>
                <p className="text-[14px] text-mauve mt-1">{d}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="feat-h">
          <h2 id="feat-h" className="text-[26px] font-extrabold mb-4">What it does</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {FEATURES.map(([t, d]) => (
              <Card key={t} className="p-5">
                <p className="font-extrabold text-[17px]">{t}</p>
                <p className="text-[15px] text-mauve mt-1.5">{d}</p>
              </Card>
            ))}
          </div>
        </section>

        <section aria-labelledby="arch-h">
          <h2 id="arch-h" className="text-[26px] font-extrabold mb-4">Architecture</h2>
          <div className="rounded-[16px] bg-sky p-5 flex flex-col gap-3">
            <div className="grid gap-3 md:grid-cols-4">
              <Box title="Student screens" lines={['Forms, upload, chain', 'Tracking, download']} />
              <Box title="Faculty screens" lines={['Inbox, swipe/button', 'Signature, profile']} />
              <Box title="Admin console" lines={['Designations, templates', 'Audit, users, requests']} />
              <Box title="Public verify" lines={['#/verify/<ID>', 'ID or PDF upload']} />
            </div>
            <ArrowDown className="mx-auto" aria-hidden />
            <Box dark title="Store (src/lib/store.ts) — the workflow engine" lines={['Stage transitions with access rules · smart scan · SLA checks · notifications', 'PDF issuance (jsPDF + pdf-lib) · SHA-256 fingerprints · hash-chained audit log']} />
            <ArrowDown className="mx-auto" aria-hidden />
            <div className="grid gap-3 md:grid-cols-3">
              <Box title="Browser storage" lines={['Default; works offline', 'Live across tabs']} />
              <Box title="Supabase (optional)" lines={['Postgres tables + realtime', 'Shared across devices']} />
              <Box title="/api/chat (optional)" lines={['Server-side Gemini call', 'Key never reaches the browser']} />
            </div>
          </div>
        </section>

        <section className="grid md:grid-cols-2 gap-5">
          <Card className="p-6">
            <h2 className="text-[22px] font-extrabold">Built with</h2>
            <div className="flex flex-wrap gap-2 mt-3">
              {STACK.map(t => (
                <span key={t} className="rounded-full bg-mist px-3 py-1 text-[14px] font-semibold">{t}</span>
              ))}
            </div>
            <p className="text-[15px] text-mauve mt-4">EzScene builds on the team’s earlier ApplyEase workflow engine. The README lists exactly what was carried over and what is new, plus every third-party library and its license.</p>
          </Card>
          <Card className="p-6">
            <h2 className="text-[22px] font-extrabold flex items-center gap-2">
              <Scale size={22} /> Open source
            </h2>
            <p className="text-[16px] mt-2">
              Released under the <strong>{LICENSE_NAME}</strong>. Use it, adapt it for your own university, and send improvements back.
            </p>
            {REPO_URL ? (
              <a href={REPO_URL} target="_blank" rel="noopener" className="mt-4 inline-flex items-center gap-2 font-bold text-teal">
                <Github size={18} /> {REPO_URL.replace(/^https?:\/\//, '')} <ArrowRight size={16} />
              </a>
            ) : (
              <p className="text-[15px] text-mauve mt-4">The repository link appears here once VITE_REPO_URL is set.</p>
            )}
          </Card>
        </section>

        {canReset && (
          <section className="rounded-[14px] border border-line bg-white p-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-extrabold">Start the demo over</p>
              <p className="text-mauve text-[15px]">Restores the sample accounts, forms and requests{isCloudConfigured() ? ' in the shared database' : ' in this browser'}.</p>
            </div>
            <Button variant="outline" onClick={() => setConfirmReset(true)}>
              <RotateCcw size={17} /> Reset demo data
            </Button>
          </section>
        )}
      </main>

      <Modal open={confirmReset} onClose={() => setConfirmReset(false)} title="Reset demo data?">
        <p className="text-mauve">Every request, signature and account change made since the start will be replaced with the original sample data. You’ll be signed out.</p>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={() => setConfirmReset(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              s.resetToDefaults();
              setConfirmReset(false);
              toast('success', 'Demo data restored');
              navigate('/', true);
            }}
          >
            Reset
          </Button>
        </div>
      </Modal>
    </div>
  );
}

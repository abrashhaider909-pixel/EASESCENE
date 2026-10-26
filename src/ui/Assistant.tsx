import { useEffect, useRef, useState } from 'react';
import { MessageCircleQuestion, Send, X } from 'lucide-react';
import { cx } from './kit';
import { useStore } from '../lib/store';

interface Msg {
  role: 'user' | 'model';
  text: string;
}

/** Built-in answers used when the Gemini endpoint isn't configured or reachable. */
const FAQ: { match: RegExp; answer: string }[] = [
  { match: /track|status|where|whose desk|progress/i, answer: 'Open “My requests”. The black card shows whose desk your request is on right now, and the timeline lists every signature with its time.' },
  { match: /reminder|remind|slow|waiting/i, answer: 'If a request has been on one desk for more than 24 hours, “Send reminder” unlocks on the request page. One reminder per desk per day.' },
  { match: /withdraw|cancel/i, answer: 'Open the request under “My requests” and choose “Withdraw request”. Only requests that are still in progress can be withdrawn.' },
  { match: /chain|signer|who signs|order|dean|hod|advisor/i, answer: 'After you fill a form or upload a document, smart scan suggests who signs and in what order. You can reorder, add or remove designations before you press “Send request”.' },
  { match: /upload|word|docx|pdf/i, answer: 'Choose “New application → Upload / drag & drop”. PDF and Word files up to 10 MB are accepted. For PDFs, your original pages are kept and the signed approval sheet is attached at the end.' },
  { match: /download|print|certificate|stamped/i, answer: 'When the last signer approves, the request turns green under “My requests”. Open it and press “Download PDF” or “Print”. Each PDF carries a QR code and ID anyone can verify.' },
  { match: /verify|genuine|fake|authentic|qr/i, answer: 'Scan the QR on the PDF or open the verification page and enter the document ID (e.g. EZ-2026-0398). Uploading the PDF itself checks its SHA-256 fingerprint.' },
  { match: /password|forgot|reset|otp|code/i, answer: 'On the log-in page choose “Forgot password?”. A 6-digit code is sent to your university email and expires in 10 minutes.' },
  { match: /signature|sign|swipe|button mode/i, answer: 'Faculty save their signature once in Profile. Approving stamps it in the right block automatically. On a phone you can review in Swipe mode (right to approve, left to reject) or Button mode.' },
  { match: /reject|rejected|reason/i, answer: 'A rejected request shows the reason under “My requests”. You can start a new application with the corrected details.' }
];

function localAnswer(q: string) {
  return FAQ.find(f => f.match.test(q))?.answer || 'I can help with filling forms, approval chains, tracking, reminders, downloads and verification. For policy questions, please contact the registrar’s office.';
}

export function Assistant() {
  const { currentUser } = useStore();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, open]);

  const send = async () => {
    const q = input.trim();
    if (!q || busy) return;
    setInput('');
    const history = messages.map(m => ({ role: m.role, parts: [{ text: m.text }] }));
    setMessages(m => [...m, { role: 'user', text: q }]);
    setBusy(true);
    let reply = '';
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: q, history, role: currentUser.role }) });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.reply) reply = data.reply;
    } catch {
      /* fall through to built-in answers */
    }
    setMessages(m => [...m, { role: 'model', text: reply || localAnswer(q) }]);
    setBusy(false);
  };

  return (
    <>
      <button
        aria-label="Help assistant"
        onClick={() => setOpen(o => !o)}
        className="fixed z-40 bottom-4 left-4 w-12 h-12 rounded-full bg-ink text-cyan shadow-lg inline-flex items-center justify-center hover:scale-105 transition-transform"
      >
        {open ? <X size={22} /> : <MessageCircleQuestion size={22} />}
      </button>
      {open && (
        <div role="dialog" aria-label="Help assistant" className="fixed z-40 bottom-20 left-4 w-[min(360px,calc(100vw-32px))] h-[440px] bg-white border border-line rounded-[16px] shadow-2xl flex flex-col overflow-hidden">
          <div className="bg-ink text-white px-4 py-3">
            <p className="font-extrabold">Ask EzScene</p>
            <p className="text-xs text-white/70">Forms, approvals, tracking and downloads</p>
          </div>
          <div ref={listRef} className="flex-1 overflow-auto p-3 flex flex-col gap-2 bg-paper">
            {messages.length === 0 && <p className="text-sm text-mauve p-2">Try “How do I track my request?” or “Who signs a NOC?”</p>}
            {messages.map((m, i) => (
              <div key={i} className={cx('max-w-[85%] rounded-[12px] px-3 py-2 text-[15px] whitespace-pre-wrap', m.role === 'user' ? 'self-end bg-ink text-white' : 'self-start bg-white border border-line')}>
                {m.text}
              </div>
            ))}
            {busy && <div className="self-start text-sm text-mauve px-2">Thinking…</div>}
          </div>
          <form
            className="flex gap-2 p-2 border-t border-line"
            onSubmit={e => {
              e.preventDefault();
              void send();
            }}
          >
            <input value={input} onChange={e => setInput(e.target.value)} maxLength={1000} placeholder="Type a question" aria-label="Your question" className="flex-1 min-h-11 px-3 rounded-[8px] border border-line focus:outline-none focus:border-teal" />
            <button type="submit" aria-label="Send" disabled={!input.trim() || busy} className="w-11 h-11 rounded-[8px] bg-ink text-cyan inline-flex items-center justify-center disabled:opacity-40">
              <Send size={18} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}

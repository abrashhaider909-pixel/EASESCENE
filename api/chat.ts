/**
 * EzScene — help assistant endpoint
 * Vercel serverless function: POST /api/chat
 *
 * Calls Google Gemini on the server so the API key is never exposed to
 * the browser. The frontend sends { history, message }; this function
 * returns { reply } or { error }.
 *
 * Security measures:
 *  - API key read from process.env only (never logged or returned)
 *  - Request body validated: message length, history depth, role values
 *  - Output tokens capped
 *  - No database access; no student records forwarded to the model
 *  - Stack traces stripped from user-facing errors
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

/* ── Constants ───────────────────────────────────────────────────────────── */
const MAX_MESSAGE_LENGTH = 1000;   // characters per user turn
const MAX_HISTORY_TURNS  = 10;     // pairs kept for context window
const MAX_OUTPUT_TOKENS  = 512;

const SYSTEM_INSTRUCTION = `
You are the help assistant for EzScene, a university platform where students
fill NOCs, leave requests, clearances and other forms online (or upload their
own PDF/Word file), choose an approval chain (e.g. Course Advisor -> Head of
Department -> Dean), and download a stamped, print-ready PDF once everyone signs.

Facts you can rely on:
- Students: New application -> fill a form or upload -> smart scan suggests the
  approval chain -> reorder/add/remove signers -> Send request. Track it under
  My requests (shows whose desk it is on, live). Reminders unlock after 24 hours
  on one desk. Requests in progress can be withdrawn.
- Faculty: save a signature once (draw or upload PNG). Approving stamps it in
  the right block automatically. Phone review uses Swipe mode (right approve,
  left reject with a reason) or Button mode.
- Admin: maps designations to people when leadership changes (pending requests
  move to the new holder), manages form templates, user accounts, and the
  hash-chained audit log; verifies documents by ID or by uploading the PDF.
- Every issued PDF has a QR code, a document ID and a SHA-256 fingerprint.
- Forgotten passwords are reset with a 6-digit code sent to university email.

Rules: never approve, sign or issue anything; never invent university policies,
deadlines or fees — suggest contacting the registrar's office instead; never ask
for passwords. Keep answers to 2-4 sentences.
`.trim();

/* ── Allowed roles ───────────────────────────────────────────────────────── */
type Role = 'user' | 'model';
interface Turn { role: Role; parts: [{ text: string }] }

function isValidRole(r: unknown): r is Role {
  return r === 'user' || r === 'model';
}

/* ── Handler ─────────────────────────────────────────────────────────────── */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  /* Only POST */
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  /* API key */
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    console.error('[chat] GEMINI_API_KEY is not configured.');
    return res.status(503).json({
      error: 'The AI assistant is not configured yet. Please check back later.'
    });
  }

  /* Parse body */
  const { message, history } = req.body ?? {};

  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Message is required.' });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ error: 'Message is too long (max 1000 characters).' });
  }

  /* Validate & sanitize history */
  const rawHistory: unknown[] = Array.isArray(history) ? history : [];
  const safeHistory: Turn[] = rawHistory
    .slice(-MAX_HISTORY_TURNS * 2)          // cap depth
    .filter((t): t is Turn => {
      if (!t || typeof t !== 'object') return false;
      const turn = t as Record<string, unknown>;
      if (!isValidRole(turn.role)) return false;
      const parts = turn.parts;
      if (!Array.isArray(parts) || parts.length === 0) return false;
      const first = parts[0] as Record<string, unknown>;
      return typeof first?.text === 'string' && first.text.length <= MAX_MESSAGE_LENGTH;
    });

  /* Call Gemini */
  try {
    const genai = new GoogleGenAI({ apiKey });

    const chat = genai.chats.create({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
      },
      history: safeHistory,
    });

    const response = await chat.sendMessage({ message: message.trim() });
    const reply = response.text ?? '';

    return res.status(200).json({ reply });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);

    /* Distinguish quota / auth errors from generic ones */
    if (/quota|rate.?limit|429/i.test(msg)) {
      return res.status(429).json({ error: 'The assistant is busy right now. Please try again in a moment.' });
    }
    if (/api.?key|401|403|invalid/i.test(msg)) {
      console.error('[chat] Gemini auth error:', msg);
      return res.status(503).json({ error: 'The AI assistant is temporarily unavailable.' });
    }

    console.error('[chat] Gemini error:', msg);
    return res.status(502).json({ error: 'The assistant could not respond. Please try again.' });
  }
}

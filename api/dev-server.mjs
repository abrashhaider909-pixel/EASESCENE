/**
 * Local development proxy for the /api/chat endpoint.
 * Run alongside `vite dev` with:  node api/dev-server.mjs
 * Reads GEMINI_API_KEY from .env via --env-file or dotenv.
 *
 * NOT used in production (Vercel runs api/chat.ts as a serverless function).
 */

import 'dotenv/config';
import express from 'express';
import { GoogleGenAI } from '@google/genai';

const PORT = 3001;

const MAX_MESSAGE_LENGTH = 1000;
const MAX_HISTORY_TURNS  = 10;
const MAX_OUTPUT_TOKENS  = 512;

const SYSTEM_INSTRUCTION = `
You are the Application Assistant for EzScene, the administrative workflow
platform of the university.
Help users understand how to submit and track applications. Do not approve
applications, issue documents, or fabricate official university policies.
If you do not know an official policy, say so and suggest contacting the
relevant department. Keep answers concise.
`.trim();

const app = express();
app.use(express.json({ limit: '16kb' }));

/* Allow Vite dev server (port 3000) to call this */
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});
app.options('/api/chat', (_req, res) => res.sendStatus(204));

app.post('/api/chat', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return res.status(503).json({ error: 'GEMINI_API_KEY is not set in .env' });
  }

  const { message, history } = req.body ?? {};
  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Message is required.' });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ error: 'Message too long.' });
  }

  const safeHistory = (Array.isArray(history) ? history : [])
    .slice(-MAX_HISTORY_TURNS * 2)
    .filter(t => (t?.role === 'user' || t?.role === 'model') &&
                  Array.isArray(t.parts) &&
                  typeof t.parts[0]?.text === 'string');

  try {
    const genai = new GoogleGenAI({ apiKey });
    const chat = genai.chats.create({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      config: { systemInstruction: SYSTEM_INSTRUCTION, maxOutputTokens: MAX_OUTPUT_TOKENS },
      history: safeHistory,
    });
    const response = await chat.sendMessage({ message: message.trim() });
    return res.json({ reply: response.text ?? '' });
  } catch (err) {
    const msg = String(err?.message ?? err);
    if (/quota|429/i.test(msg)) return res.status(429).json({ error: 'Rate limit reached. Try again shortly.' });
    console.error('[dev-server] Gemini error:', msg);
    return res.status(502).json({ error: 'AI unavailable. Check your API key and try again.' });
  }
});

app.listen(PORT, () => {
  console.log(`[EzScene] AI dev proxy running at http://localhost:${PORT}`);
});

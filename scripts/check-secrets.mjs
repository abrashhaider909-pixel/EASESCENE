#!/usr/bin/env node
/**
 * Fails if anything that looks like a real credential is about to be committed.
 * Run: npm run check:secrets   (also runs in CI)
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SKIP_DIRS = new Set(['node_modules', 'dist', 'dist-single', '.git', 'coverage', 'test-results']);
const SKIP_FILES = new Set(['package-lock.json', 'check-secrets.mjs']);
const PATTERNS = [
  ['Google API key', /AIza[0-9A-Za-z_-]{35}/],
  ['Supabase secret / service key', /sb_secret_[0-9A-Za-z_-]{10,}|service_role["']?\s*[:=]\s*["']eyJ/],
  ['JWT-looking token', /eyJhbGciOi[0-9A-Za-z_-]{20,}\.[0-9A-Za-z_-]{20,}\.[0-9A-Za-z_-]{10,}/],
  ['GitHub token', /gh[pousr]_[0-9A-Za-z]{30,}/],
  ['OpenAI / Anthropic style key', /\bsk-(ant-)?[0-9A-Za-z_-]{30,}/],
  ['AWS access key', /AKIA[0-9A-Z]{16}/],
  ['Private key block', /-----BEGIN [A-Z ]*PRIVATE KEY-----/]
];

const findings = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (!SKIP_DIRS.has(name)) walk(full);
      continue;
    }
    if (SKIP_FILES.has(name) || st.size > 2_000_000) continue;
    if (/\.(png|jpe?g|gif|webp|pdf|woff2?|ico|zip)$/i.test(name)) continue;
    const text = readFileSync(full, 'utf8');
    for (const [label, re] of PATTERNS) if (re.test(text)) findings.push(`${relative(ROOT, full)}: ${label}`);
  }
}
walk(ROOT);

for (const f of ['.env', '.env.local', '.env.production', 'CREDENTIALS.local.md']) {
  if (existsSync(join(ROOT, f))) console.warn(`note: ${f} exists locally — it is git-ignored, keep it that way.`);
}

if (findings.length) {
  console.error('Possible secrets found:\n  ' + findings.join('\n  '));
  process.exit(1);
}
console.log('No secrets found.');

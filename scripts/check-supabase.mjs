/**
 * EzScene database check
 * ---------------------------------------------------------------------------
 * Verifies the Supabase project is reachable, that every EzScene table
 * exists, and prints row counts. Run it after applying supabase/schema.sql:
 *
 *   npm run db:check
 *
 * Exit code 0 = schema installed and readable; 1 = missing tables or bad config.
 */

import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key || url.includes('YOUR_')) {
  console.error('✗ Missing credentials. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const tables = [
  ['profiles', 'User accounts'],
  ['application_types', 'Application types'],
  ['applications', 'Applications'],
  ['signature_assets', 'Signature assets'],
  ['stamp_assets', 'Official seals'],
  ['audit_logs', 'Audit trail'],
  ['notifications', 'Notifications'],
  ['designations', 'Designations']
];

console.log(`Project: ${url}`);
console.log('');

let failures = 0;
let rows = 0;

for (const [table, label] of tables) {
  // A HEAD request returns no body, which hides PostgREST errors (a missing
  // table would look like "0 rows"). Use a real GET with an exact count.
  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact' })
    .limit(1);

  if (error) {
    failures += 1;
    console.log(`✗ ${table.padEnd(18)} ${label} — ${error.message}`);
  } else {
    rows += count ?? 0;
    console.log(`✓ ${table.padEnd(18)} ${label} — ${count ?? 0} rows`);
  }
}

console.log('');
if (failures > 0) {
  console.error(`${failures} table(s) missing. Run supabase/schema.sql in the Supabase SQL Editor.`);
  process.exit(1);
}

console.log(`All 7 tables present (${rows} rows total).`);
if (rows === 0) {
  console.log('Database is empty — the app will seed it automatically on first connection.');
}

/**
 * ApplyEase Supabase Client
 * ---------------------------------------------------------------------------
 * Credentials can come from two places, in priority order:
 *   1. Runtime configuration saved by an administrator in the app
 *      (Admin → Cloud & Data). Stored in localStorage so a deployed build can
 *      be connected without editing files or rebuilding.
 *   2. Build-time env vars. Both key formats are supported:
 *        VITE_SUPABASE_PUBLISHABLE_KEY  (sb_publishable_…)
 *        VITE_SUPABASE_ANON_KEY         (legacy eyJhbGciOi… JWT)
 *
 * The client is created lazily and cached against the active configuration, so
 * connecting or disconnecting at runtime immediately takes effect everywhere.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export type CloudConfigSource = 'env' | 'runtime' | 'none';

export interface CloudConfig {
  url: string;
  anonKey: string;
  source: CloudConfigSource;
}

export interface ConnectionResult {
  ok: boolean;
  code: 'ok' | 'unconfigured' | 'invalid' | 'network' | 'missing_schema' | 'permission';
  message: string;
}

const RUNTIME_KEY = 'applyease_supabase_config';

const ENV_URL = String(import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const ENV_KEY = String(
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    import.meta.env.VITE_SUPABASE_ANON_KEY ??
    ''
).trim();

/** Reject the shipped placeholders and obviously malformed values. */
function looksValid(url: string, key: string): boolean {
  if (!/^https?:\/\/[^\s]+$/i.test(url)) return false;
  if (key.length < 20) return false;
  if (/YOUR_|YOUR-PROJECT|example\.com/i.test(url)) return false;
  if (/YOUR_|your-anon/i.test(key)) return false;
  return true;
}

function readRuntimeConfig(): { url: string; anonKey: string } | null {
  try {
    const raw = localStorage.getItem(RUNTIME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { url?: string; anonKey?: string };
    if (!parsed?.url || !parsed?.anonKey) return null;
    if (!looksValid(parsed.url, parsed.anonKey)) return null;
    return { url: parsed.url.trim(), anonKey: parsed.anonKey.trim() };
  } catch {
    return null;
  }
}

/** Active configuration, whatever its source. */
export function getCloudConfig(): CloudConfig {
  const runtime = readRuntimeConfig();
  if (runtime) return { ...runtime, source: 'runtime' };
  if (looksValid(ENV_URL, ENV_KEY)) {
    return { url: ENV_URL, anonKey: ENV_KEY, source: 'env' };
  }
  return { url: '', anonKey: '', source: 'none' };
}

export function isCloudConfigured(): boolean {
  return getCloudConfig().source !== 'none';
}

let cachedClient: SupabaseClient | null = null;
let cachedSignature = '';

/** Lazily build (and reuse) the Supabase client for the active configuration. */
export function getSupabase(): SupabaseClient | null {
  const config = getCloudConfig();
  if (config.source === 'none') {
    cachedClient = null;
    cachedSignature = '';
    return null;
  }
  const signature = `${config.url}::${config.anonKey.slice(-12)}`;
  if (cachedClient && cachedSignature === signature) return cachedClient;

  cachedClient = createClient(config.url, config.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  cachedSignature = signature;
  return cachedClient;
}

/** Persist runtime credentials (administrator action). */
export function saveCloudConfig(url: string, anonKey: string): { ok: boolean; error?: string } {
  const cleanUrl = url.trim().replace(/\/+$/, '');
  const cleanKey = anonKey.trim();

  if (!cleanUrl || !cleanKey) {
    return { ok: false, error: 'Both the project URL and the anon public key are required.' };
  }
  if (!/^https?:\/\/[^\s]+$/i.test(cleanUrl)) {
    return { ok: false, error: 'The project URL must start with https:// (for example https://abcdefgh.supabase.co).' };
  }
  if (cleanKey.length < 20) {
    return { ok: false, error: 'That key looks too short — copy the full publishable key (sb_publishable_…) or the legacy anon public key from Project Settings → API.' };
  }

  try {
    localStorage.setItem(RUNTIME_KEY, JSON.stringify({ url: cleanUrl, anonKey: cleanKey, savedAt: new Date().toISOString() }));
  } catch {
    return { ok: false, error: 'This browser blocked local storage, so the connection cannot be remembered.' };
  }

  cachedClient = null;
  cachedSignature = '';
  return { ok: true };
}

/** Forget runtime credentials and fall back to env vars (or local mode). */
export function clearCloudConfig(): void {
  try {
    localStorage.removeItem(RUNTIME_KEY);
  } catch {
    /* ignore */
  }
  cachedClient = null;
  cachedSignature = '';
}

/**
 * Probe a set of credentials before adopting them.
 * Distinguishes "wrong key / unreachable" from "schema not installed yet",
 * which is the single most common setup mistake.
 */
export async function probeConnection(url: string, anonKey: string): Promise<ConnectionResult> {
  if (!looksValid(url, anonKey)) {
    return { ok: false, code: 'invalid', message: 'Enter a valid https:// project URL and the full anon public key.' };
  }

  let probe: SupabaseClient;
  try {
    probe = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  } catch (error: any) {
    return { ok: false, code: 'invalid', message: error?.message || 'Could not create a Supabase client.' };
  }

  try {
    const { error } = await probe.from('profiles').select('id').limit(1);
    if (!error) {
      return { ok: true, code: 'ok', message: 'Connected. The ApplyEase schema is installed and readable.' };
    }

    const code = (error as any).code as string | undefined;
    const message = error.message || 'Unknown error';

    if (code === '42P01' || /does not exist|schema cache|Could not find the table/i.test(message)) {
      return {
        ok: false,
        code: 'missing_schema',
        message: 'Credentials are valid, but the ApplyEase tables are missing. Run supabase/schema.sql in the Supabase SQL Editor, then connect again.'
      };
    }
    if (code === '42501' || /permission denied|row-level security/i.test(message)) {
      return {
        ok: false,
        code: 'permission',
        message: 'The key was accepted but row-level security blocked the read. Re-run the policies section of supabase/schema.sql.'
      };
    }
    if (/invalid api key|InvalidJWT|JWT/i.test(message)) {
      return { ok: false, code: 'invalid', message: 'Supabase rejected the key. Copy the publishable key (or the legacy anon public key) from Project Settings → API.' };
    }
    return { ok: false, code: 'network', message: `Could not reach the project: ${message}` };
  } catch (error: any) {
    return {
      ok: false,
      code: 'network',
      message: `Network error reaching Supabase: ${error?.message || 'request failed'}. Check the project URL and your connection.`
    };
  }
}

/** Probe the credentials currently in use (used by the admin cloud page). */
export async function testSupabaseConnection(): Promise<ConnectionResult> {
  const config = getCloudConfig();
  if (config.source === 'none') {
    return { ok: false, code: 'unconfigured', message: 'No Supabase credentials are configured yet.' };
  }
  return probeConnection(config.url, config.anonKey);
}

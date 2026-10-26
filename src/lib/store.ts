/**
 * EzScene central store & persistence layer
 * ---------------------------------------------------------------------------
 * Built on the ApplyEase engine: reactive state persisted to browser storage,
 * optional write-through + realtime sync with Supabase, role-checked workflow
 * transitions, a hash-chained audit trail, notifications, SLA checks and the
 * PDF issuance pipeline. EzScene adds designations, student-chosen approval
 * chains, saved signatures, drafts, reminders, withdrawals and password reset.
 */

import { useEffect, useState } from 'react';
import { sha256 } from 'js-sha256';
import {
  UserProfile,
  ApplicationType,
  Application,
  SignatureAsset,
  StampAsset,
  AuditLog,
  NotificationItem,
  UploadedDocument,
  Designation,
  ApplicationStageInstance,
  TimelineEvent
} from '../types';
import {
  INITIAL_USERS,
  INITIAL_APPLICATION_TYPES,
  INITIAL_APPLICATIONS,
  INITIAL_SIGNATURES,
  INITIAL_STAMPS,
  INITIAL_AUDIT_LOGS,
  INITIAL_NOTIFICATIONS,
  INITIAL_DESIGNATIONS,
  shortTitle
} from './constants';
import { addBusinessHours, runSLASchedulerCheck } from './slaEngine';
import { calculateDocumentHash, dataUrlToBytes, sha256Bytes } from './pdfGenerator';
import { buildIssuedPackage, PDF_RENDER_VERSION } from './officialPdf';
import { canSignStage, currentStage, ownSignature, sealFor } from './access';
import { cloud, pullAll, seedIfEmpty, pushAll, subscribeToChanges, setCloudErrorHandler, wipeCloud, CloudData } from './cloud';
import { isCloudConfigured as isCloudConfiguredNow, saveCloudConfig, clearCloudConfig, probeConnection } from './supabase';
import { toast } from './toast';

export type CloudStatus = 'local' | 'connecting' | 'online' | 'offline';
export type ApprovalMode = 'swipe' | 'button';

export function isCloudConfigured(): boolean {
  return isCloudConfiguredNow();
}

const SEED_VERSION = '3';
const K = {
  SEED: 'ezscene_seed_version',
  SESSION: 'ezscene_session',
  CURRENT_USER: 'ezscene_current_user',
  USERS: 'ezscene_users',
  APPLICATION_TYPES: 'ezscene_app_types',
  APPLICATIONS: 'ezscene_applications',
  SIGNATURES: 'ezscene_signatures',
  STAMPS: 'ezscene_stamps',
  AUDIT_LOGS: 'ezscene_audit_logs',
  NOTIFICATIONS: 'ezscene_notifications',
  DESIGNATIONS: 'ezscene_designations',
  PREFS: 'ezscene_prefs'
};

function safeLoad<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function safeSave(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`[EzScene] Could not save ${key} (storage full or blocked).`, e);
  }
}

// A newer seed replaces older local demo data.
try {
  if (localStorage.getItem(K.SEED) !== SEED_VERSION) {
    Object.values(K).forEach(k => k !== K.PREFS && localStorage.removeItem(k));
    localStorage.setItem(K.SEED, SEED_VERSION);
  }
} catch {
  /* storage blocked: run from memory */
}

/* ------------------------------------------------------ audit hash chain */

function entryContent(l: AuditLog): string {
  return [l.id, l.timestamp, l.actorId, l.actorRole, l.action, l.details, l.applicationRef || ''].join('|');
}

function chainLogs(logsNewestFirst: AuditLog[]): AuditLog[] {
  const asc = [...logsNewestFirst].reverse();
  let prev = 'GENESIS';
  const out = asc.map(l => {
    if (l.entryHash && l.prevHash) {
      prev = l.entryHash;
      return l;
    }
    const entryHash = sha256(`${prev}|${entryContent(l)}`);
    const chained = { ...l, prevHash: prev, entryHash };
    prev = entryHash;
    return chained;
  });
  return out.reverse();
}

/* ----------------------------------------------------------------- state */

type Prefs = Record<string, { approvalMode?: ApprovalMode; tutorialSeen?: boolean; signatureSkipped?: boolean }>;

let state = {
  isAuthenticated: false,
  currentUser: safeLoad<UserProfile>(K.CURRENT_USER, INITIAL_USERS[0]),
  users: safeLoad<UserProfile[]>(K.USERS, INITIAL_USERS),
  applicationTypes: safeLoad<ApplicationType[]>(K.APPLICATION_TYPES, INITIAL_APPLICATION_TYPES),
  applications: safeLoad<Application[]>(K.APPLICATIONS, INITIAL_APPLICATIONS),
  signatures: safeLoad<SignatureAsset[]>(K.SIGNATURES, INITIAL_SIGNATURES),
  stamps: safeLoad<StampAsset[]>(K.STAMPS, INITIAL_STAMPS),
  auditLogs: chainLogs(safeLoad<AuditLog[]>(K.AUDIT_LOGS, INITIAL_AUDIT_LOGS)),
  notifications: safeLoad<NotificationItem[]>(K.NOTIFICATIONS, INITIAL_NOTIFICATIONS),
  designations: safeLoad<Designation[]>(K.DESIGNATIONS, INITIAL_DESIGNATIONS),
  prefs: safeLoad<Prefs>(K.PREFS, {}),
  cloudStatus: 'local' as CloudStatus,
  cloudIssue: 'none' as 'none' | 'schema' | 'network',
  isHydrating: false
};

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach(fn => fn());
}

function persistAll() {
  safeSave(K.USERS, state.users);
  safeSave(K.APPLICATION_TYPES, state.applicationTypes);
  safeSave(K.APPLICATIONS, state.applications);
  safeSave(K.SIGNATURES, state.signatures);
  safeSave(K.STAMPS, state.stamps);
  safeSave(K.AUDIT_LOGS, state.auditLogs);
  safeSave(K.NOTIFICATIONS, state.notifications);
  safeSave(K.DESIGNATIONS, state.designations);
  safeSave(K.CURRENT_USER, state.currentUser);
}

/* ------------------------------------------------- cloud synchronisation */

let cloudSyncStarted = false;
let isPulling = false;
let lastSelfPushAt = 0;
let lastHydrateAttemptAt = 0;
let warnedMissingConfig = false;
let unsubscribeRealtime: (() => void) | null = null;
let lastCloudErrorAt = 0;

setCloudErrorHandler(message => {
  const now = Date.now();
  if (now - lastCloudErrorAt > 15000) {
    lastCloudErrorAt = now;
    state.cloudStatus = 'offline';
    console.warn('[EzScene Cloud]', message);
    toast('warning', 'Working offline', 'Changes are saved on this device and will sync when the connection returns.');
    notify();
  }
});

const markSelfPush = () => (lastSelfPushAt = Date.now());
const cloudWritable = () => cloud.enabled && state.cloudStatus !== 'offline';

function applyCloudData(data: CloudData) {
  const localUsers = new Map(state.users.map(u => [u.id, u]));
  state.users = data.users.map(u => {
    const local = localUsers.get(u.id);
    return local?.avatarUrl && !u.avatarUrl ? { ...u, avatarUrl: local.avatarUrl } : u;
  });
  state.applicationTypes = data.applicationTypes.length ? data.applicationTypes : state.applicationTypes;
  state.applications = data.applications;
  state.signatures = data.signatures.length ? data.signatures : state.signatures;
  state.stamps = data.stamps.length ? data.stamps : state.stamps;
  state.auditLogs = chainLogs(data.auditLogs);
  state.notifications = data.notifications;
  state.designations = data.designations.length ? data.designations : state.designations;
  const fresh = state.users.find(u => u.id === state.currentUser.id);
  if (fresh) state.currentUser = fresh;
  persistAll();
}

async function hydrateFromCloud(silent = false): Promise<boolean> {
  if (!cloud.enabled || isPulling) return false;
  isPulling = true;
  if (!silent) {
    state.cloudStatus = 'connecting';
    notify();
  }
  try {
    await seedIfEmpty();
    applyCloudData(await pullAll());
    state.cloudStatus = 'online';
    state.cloudIssue = 'none';
    return true;
  } catch (e: any) {
    console.warn('[EzScene Cloud] Falling back to local data:', e?.message);
    state.cloudStatus = 'offline';
    state.cloudIssue = /could not find the table|does not exist|schema cache/i.test(String(e?.message)) ? 'schema' : 'network';
    if (!silent) toast('warning', 'Working offline', 'Your changes are saved on this device and will sync automatically.');
    return false;
  } finally {
    isPulling = false;
    notify();
  }
}

async function ensureCloudSync(): Promise<boolean> {
  if (!cloud.enabled) {
    if (!warnedMissingConfig) {
      warnedMissingConfig = true;
      console.info('[EzScene Cloud] No Supabase configured — running on browser storage. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to share data across devices.');
    }
    return false;
  }
  if (cloudSyncStarted) return state.cloudStatus === 'online';
  if (Date.now() - lastHydrateAttemptAt < 3000) return false;
  lastHydrateAttemptAt = Date.now();
  cloudSyncStarted = true;
  state.isHydrating = true;
  notify();
  const ok = await hydrateFromCloud();
  state.isHydrating = false;
  if (ok) {
    unsubscribeRealtime?.();
    try {
      unsubscribeRealtime = subscribeToChanges(() => {
        if (isPulling || Date.now() - lastSelfPushAt < 1500) return;
        void hydrateFromCloud(true);
      });
    } catch {
      unsubscribeRealtime = null;
    }
  } else {
    cloudSyncStarted = false;
  }
  notify();
  return ok;
}

function saveApps(...ids: string[]) {
  safeSave(K.APPLICATIONS, state.applications);
  if (!cloudWritable()) return;
  const apps = state.applications.filter(a => ids.includes(a.id));
  if (apps.length) {
    markSelfPush();
    cloud.pushApplications(apps);
  }
}
function saveTypes(...ids: string[]) {
  safeSave(K.APPLICATION_TYPES, state.applicationTypes);
  if (!cloudWritable()) return;
  state.applicationTypes.filter(t => ids.includes(t.id)).forEach(t => {
    markSelfPush();
    cloud.pushApplicationType(t);
  });
}
function saveUsers(...ids: string[]) {
  safeSave(K.USERS, state.users);
  if (!cloud.enabled) return;
  const users = state.users.filter(u => ids.includes(u.id));
  if (users.length) {
    markSelfPush();
    cloud.pushUsers(users);
  }
}
function saveDesignations(...ids: string[]) {
  safeSave(K.DESIGNATIONS, state.designations);
  if (!cloudWritable()) return;
  const items = state.designations.filter(d => ids.includes(d.id));
  if (items.length) {
    markSelfPush();
    cloud.pushDesignations(items);
  }
}

// Live updates across tabs of the same browser (e.g. a student tab and a
// faculty tab) — the realtime channel handles other devices when Supabase is on.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', e => {
    if (!e.key || !e.key.startsWith('ezscene_') || e.key === K.SESSION || e.key === K.CURRENT_USER) return;
    const map: Record<string, keyof typeof state> = {
      [K.USERS]: 'users',
      [K.APPLICATION_TYPES]: 'applicationTypes',
      [K.APPLICATIONS]: 'applications',
      [K.SIGNATURES]: 'signatures',
      [K.STAMPS]: 'stamps',
      [K.AUDIT_LOGS]: 'auditLogs',
      [K.NOTIFICATIONS]: 'notifications',
      [K.DESIGNATIONS]: 'designations',
      [K.PREFS]: 'prefs'
    };
    const field = map[e.key];
    if (!field || !e.newValue) return;
    try {
      (state as any)[field] = JSON.parse(e.newValue);
      if (field === 'users') {
        const fresh = state.users.find(u => u.id === state.currentUser.id);
        if (fresh) state.currentUser = fresh;
      }
      notify();
    } catch {
      /* ignore malformed */
    }
  });
}

/* --------------------------------------------------------------- helpers */

const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const LIVE = ['submitted', 'under_verification', 'pending_approval', 'pending_signature', 'overdue', 'awaiting_student_action'];

function userById(id?: string) {
  return id ? state.users.find(u => u.id === id) : undefined;
}

function nextReference(): string {
  const year = new Date().getFullYear();
  const max = state.applications.reduce((m, a) => {
    const match = /^EZ-(\d{4})-(\d+)$/.exec(a.referenceNumber);
    return match && Number(match[1]) === year ? Math.max(m, Number(match[2])) : m;
  }, 400);
  return `EZ-${year}-${String(max + 1).padStart(4, '0')}`;
}

function stagesFromDesignations(designationIds: string[]): ApplicationStageInstance[] {
  return designationIds.map(id => {
    const d = state.designations.find(x => x.id === id);
    if (!d) throw new Error('One of the selected designations no longer exists.');
    const holder = userById(d.holderId);
    if (!holder) throw new Error(`Nobody currently holds "${d.title}". Please choose another signer.`);
    return {
      stageId: `stage-${d.id}-${Math.random().toString(36).slice(2, 6)}`,
      designationId: d.id,
      name: d.title,
      assignedDepartment: d.department,
      assignedRole: d.title,
      assignedStaffId: holder.id,
      assignedStaffName: holder.name,
      status: 'pending',
      warningCount: 0,
      slaHours: 24,
      requiresSignature: true,
      requiresStamp: false
    };
  });
}

function updateApp(id: string, fn: (a: Application) => Application) {
  state.applications = state.applications.map(a => (a.id === id ? fn(a) : a));
  saveApps(id);
}

function event(partial: Omit<TimelineEvent, 'id' | 'timestamp'>): TimelineEvent {
  return { id: uid('tl'), timestamp: new Date().toISOString(), ...partial };
}

// Password reset codes live in memory only (they expire in 10 minutes).
const resetCodes = new Map<string, { code: string; expires: number; verified: boolean; attempts: number }>();

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  return `${local[0]}${'•'.repeat(Math.max(3, local.length - 2))}${local.slice(-1)}@${domain}`;
}

/* ================================================================= store */

export const EzStore = {
  getState() {
    return state;
  },

  /* ------------------------------------------------------- session/auth */

  async authenticate(
    email: string,
    password: string,
    opts: { role?: 'student' | 'staff' | 'admin'; cmsId?: string; keepLoggedIn?: boolean } = {}
  ): Promise<{ ok: boolean; error?: string; user?: UserProfile }> {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();
    if (!cleanEmail || !cleanPassword) return { ok: false, error: 'Enter your email and password.' };

    if (cloud.enabled) await ensureCloudSync();

    let matched: UserProfile | undefined;
    if (cloud.enabled && state.cloudStatus === 'online') {
      try {
        matched = (await cloud.authenticate(cleanEmail, cleanPassword)) || undefined;
      } catch {
        /* fall back to local */
      }
    }
    if (!matched) {
      const local = state.users.find(u => u.email.toLowerCase() === cleanEmail);
      if (!local) return { ok: false, error: 'No account uses that email. Check the address or create a student account.' };
      if (!local.active) return { ok: false, error: 'This account has been deactivated. Contact the registrar’s office.' };
      if ((local.password || '123') !== cleanPassword) return { ok: false, error: 'Incorrect email or password.' };
      matched = local;
    }

    const roleNames = { student: 'student', staff: 'faculty', admin: 'admin' } as const;
    if (opts.role && matched.role !== opts.role) {
      return { ok: false, error: `This is a ${roleNames[matched.role]} account. Switch to the ${roleNames[matched.role][0].toUpperCase() + roleNames[matched.role].slice(1)} tab to log in.` };
    }
    if (matched.role === 'student' && opts.cmsId !== undefined) {
      if (opts.cmsId.trim() !== (matched.registrationNumber || '').trim()) {
        return { ok: false, error: 'That CMS ID doesn’t match this account.' };
      }
    }

    this.login(matched, opts.keepLoggedIn);
    return { ok: true, user: matched };
  },

  login(user: UserProfile, keepLoggedIn = false) {
    state.currentUser = user;
    state.isAuthenticated = true;
    safeSave(K.CURRENT_USER, user);
    try {
      if (keepLoggedIn) localStorage.setItem(K.SESSION, user.id);
      else localStorage.removeItem(K.SESSION);
    } catch {
      /* ignore */
    }
    this.addAuditLog('USER_LOGIN', `${user.name} logged in`);
    notify();
    if (cloud.enabled) void ensureCloudSync();
  },

  /** Demo mode only: sign in as a seeded account without a password. */
  demoSignIn(userId: string): UserProfile | undefined {
    const user = state.users.find(u => u.id === userId && u.active);
    if (!user) return undefined;
    state.currentUser = user;
    this.addAuditLog('DEMO_SIGN_IN', `Demo sign-in as ${user.name}`);
    if (user.role === 'staff' && !state.prefs[user.id]?.tutorialSeen) this.setPrefs(user.id, { tutorialSeen: true, approvalMode: 'swipe' });
    this.login(user);
    return user;
  },

  /** Restore a "keep me logged in" session on page load. */
  restoreSession(): boolean {
    try {
      const id = localStorage.getItem(K.SESSION);
      const user = id ? state.users.find(u => u.id === id && u.active) : undefined;
      if (user) {
        state.currentUser = user;
        state.isAuthenticated = true;
        notify();
        if (cloud.enabled) void ensureCloudSync();
        return true;
      }
    } catch {
      /* ignore */
    }
    return false;
  },

  logout() {
    this.addAuditLog('USER_LOGOUT', `${state.currentUser.name} logged out`);
    state.isAuthenticated = false;
    try {
      localStorage.removeItem(K.SESSION);
    } catch {
      /* ignore */
    }
    notify();
  },

  registerStudent(input: { name: string; email: string; cmsId: string; programme: string; department: string; password: string; phone?: string }): { ok: boolean; error?: string } {
    const email = input.email.trim().toLowerCase();
    if (!input.name.trim()) return { ok: false, error: 'Enter your full name.' };
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: 'Enter a valid university email.' };
    if (!/^\d{5,8}$/.test(input.cmsId.trim())) return { ok: false, error: 'CMS ID should be 5–8 digits.' };
    if (input.password.length < 6) return { ok: false, error: 'Use a password of at least 6 characters.' };
    if (state.users.some(u => u.email.toLowerCase() === email)) return { ok: false, error: 'An account with this email already exists. Try logging in.' };
    if (state.users.some(u => u.registrationNumber === input.cmsId.trim())) return { ok: false, error: 'An account with this CMS ID already exists.' };
    const user: UserProfile = {
      id: uid('student'),
      name: input.name.trim(),
      email,
      password: input.password,
      role: 'student',
      registrationNumber: input.cmsId.trim(),
      department: input.department,
      semester: input.programme,
      phone: input.phone || '',
      active: true
    };
    state.users = [...state.users, user];
    saveUsers(user.id);
    state.currentUser = user;
    this.addAuditLog('ACCOUNT_CREATED', `Student account created for ${user.name} (${user.registrationNumber})`);
    this.login(user);
    return { ok: true };
  },

  requestPasswordReset(email: string): { ok: boolean; error?: string; masked?: string; code?: string } {
    const user = state.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user) return { ok: false, error: 'No account uses that email.' };
    const code = String(Math.floor(100000 + Math.random() * 900000));
    resetCodes.set(user.email.toLowerCase(), { code, expires: Date.now() + 10 * 60 * 1000, verified: false, attempts: 0 });
    const prev = state.currentUser;
    state.currentUser = user;
    this.addAuditLog('PASSWORD_RESET_REQUESTED', `One-time code issued to ${maskEmail(user.email)}`);
    state.currentUser = prev;
    return { ok: true, masked: maskEmail(user.email), code };
  },

  verifyResetCode(email: string, code: string): { ok: boolean; error?: string } {
    const entry = resetCodes.get(email.trim().toLowerCase());
    if (!entry) return { ok: false, error: 'Request a new code.' };
    if (Date.now() > entry.expires) return { ok: false, error: 'This code has expired. Request a new one.' };
    entry.attempts += 1;
    if (entry.attempts > 5) return { ok: false, error: 'Too many attempts. Request a new code.' };
    if (entry.code !== code.trim()) return { ok: false, error: 'That code isn’t right. Check your email and try again.' };
    entry.verified = true;
    return { ok: true };
  },

  completePasswordReset(email: string, newPassword: string): { ok: boolean; error?: string } {
    const key = email.trim().toLowerCase();
    const entry = resetCodes.get(key);
    if (!entry?.verified) return { ok: false, error: 'Verify the code first.' };
    if (newPassword.length < 6) return { ok: false, error: 'Use at least 6 characters.' };
    const user = state.users.find(u => u.email.toLowerCase() === key);
    if (!user) return { ok: false, error: 'Account not found.' };
    state.users = state.users.map(u => (u.id === user.id ? { ...u, password: newPassword } : u));
    saveUsers(user.id);
    resetCodes.delete(key);
    const prev = state.currentUser;
    state.currentUser = user;
    this.addAuditLog('PASSWORD_RESET', `${user.name} reset their password via email code`);
    state.currentUser = prev;
    notify();
    return { ok: true };
  },

  changePassword(current: string, next: string): { ok: boolean; error?: string } {
    const me = state.users.find(u => u.id === state.currentUser.id);
    if (!me) return { ok: false, error: 'Account not found.' };
    if ((me.password || '123') !== current) return { ok: false, error: 'Your current password is incorrect.' };
    if (next.length < 6) return { ok: false, error: 'Use at least 6 characters for the new password.' };
    this.updateUser(me.id, { password: next }, 'PASSWORD_CHANGED', `${me.name} changed their password`);
    return { ok: true };
  },

  /* ------------------------------------------------------------- users */

  addUser(newUser: UserProfile) {
    if (state.users.some(u => u.email.toLowerCase() === newUser.email.toLowerCase())) {
      throw new Error('An account with this email already exists.');
    }
    state.users = [...state.users, newUser];
    saveUsers(newUser.id);
    this.addAuditLog('USER_CREATED', `Account created for ${newUser.name} (${newUser.role})`);
    notify();
  },

  updateUser(userId: string, changes: Partial<UserProfile>, action = 'USER_UPDATED', details?: string) {
    state.users = state.users.map(u => (u.id === userId ? { ...u, ...changes } : u));
    if (state.currentUser.id === userId) {
      state.currentUser = { ...state.currentUser, ...changes };
      safeSave(K.CURRENT_USER, state.currentUser);
    }
    saveUsers(userId);
    this.addAuditLog(action, details || `Account updated: ${userById(userId)?.name}`);
    notify();
  },

  deleteUser(userId: string) {
    const user = userById(userId);
    if (state.designations.some(d => d.holderId === userId)) {
      throw new Error('Reassign this person’s designations before deleting the account.');
    }
    state.users = state.users.filter(u => u.id !== userId);
    safeSave(K.USERS, state.users);
    if (cloudWritable()) {
      markSelfPush();
      cloud.deleteUser(userId);
    }
    this.addAuditLog('USER_DELETED', `Account deleted: ${user?.name || userId}`);
    notify();
  },

  /* ------------------------------------------------------ preferences */

  setPrefs(userId: string, changes: Prefs[string]) {
    state.prefs = { ...state.prefs, [userId]: { ...state.prefs[userId], ...changes } };
    safeSave(K.PREFS, state.prefs);
    notify();
  },

  /* --------------------------------------------------- audit & notices */

  addAuditLog(action: string, details: string, applicationRef?: string) {
    const prevHash = state.auditLogs[0]?.entryHash || 'GENESIS';
    const log: AuditLog = {
      id: uid('audit'),
      timestamp: new Date().toISOString(),
      actorId: state.currentUser.id,
      actorName: state.currentUser.name,
      actorRole: state.currentUser.role === 'staff' ? state.currentUser.designation || 'staff' : state.currentUser.role,
      action,
      details,
      applicationRef,
      ipAddress: 'browser session'
    };
    log.prevHash = prevHash;
    log.entryHash = sha256(`${prevHash}|${entryContent(log)}`);
    state.auditLogs = [log, ...state.auditLogs];
    safeSave(K.AUDIT_LOGS, state.auditLogs);
    if (cloudWritable()) {
      markSelfPush();
      cloud.pushAuditLog(log);
    }
    notify();
  },

  /** Recompute the audit chain and report the first broken link, if any. */
  verifyAuditChain(): { ok: boolean; checked: number; brokenId?: string } {
    const asc = [...state.auditLogs].reverse();
    let prev = 'GENESIS';
    for (const l of asc) {
      const expected = sha256(`${l.prevHash}|${entryContent(l)}`);
      if (l.entryHash !== expected) return { ok: false, checked: asc.length, brokenId: l.id };
      if (l.prevHash !== prev) return { ok: false, checked: asc.length, brokenId: l.id };
      prev = l.entryHash!;
    }
    return { ok: true, checked: asc.length };
  },

  addNotification(n: Omit<NotificationItem, 'id' | 'createdAt'>) {
    const duplicate = state.notifications.some(
      e => !e.read && e.userId === n.userId && e.title === n.title && e.message === n.message
    );
    if (duplicate) return;
    const item: NotificationItem = { ...n, id: uid('notif'), createdAt: new Date().toISOString() };
    state.notifications = [item, ...state.notifications];
    safeSave(K.NOTIFICATIONS, state.notifications);
    if (cloudWritable()) {
      markSelfPush();
      cloud.pushNotification(item);
    }
    notify();
  },

  markNotificationAsRead(id: string) {
    state.notifications = state.notifications.map(n => (n.id === id ? { ...n, read: true } : n));
    safeSave(K.NOTIFICATIONS, state.notifications);
    if (cloudWritable()) cloud.pushNotifications(state.notifications.filter(n => n.id === id));
    notify();
  },

  markAllNotificationsAsRead(userId: string) {
    const changed = state.notifications.filter(n => n.userId === userId && !n.read).map(n => ({ ...n, read: true }));
    state.notifications = state.notifications.map(n => (n.userId === userId ? { ...n, read: true } : n));
    safeSave(K.NOTIFICATIONS, state.notifications);
    if (cloudWritable() && changed.length) cloud.pushNotifications(changed);
    notify();
  },

  /* ------------------------------------------------------ applications */

  saveDraft(params: { draftId?: string; applicationTypeId: string; formData: Record<string, any>; uploadedDocuments: UploadedDocument[] }): Application {
    const type = state.applicationTypes.find(t => t.id === params.applicationTypeId);
    if (!type) throw new Error('Form not found');
    const nowIso = new Date().toISOString();
    const me = state.currentUser;
    const existing = params.draftId ? state.applications.find(a => a.id === params.draftId) : undefined;
    const draft: Application = {
      ...(existing || {
        id: uid('draft'),
        referenceNumber: 'DRAFT',
        applicationTypeId: type.id,
        applicationTypeTitle: type.title,
        templateVersion: type.publishedVersion,
        studentId: me.id,
        studentSnapshot: { name: me.name, registrationNumber: me.registrationNumber || '', email: me.email, department: me.department, phone: me.phone },
        status: 'draft',
        currentStageId: '',
        currentStageIndex: 0,
        stageInstances: [],
        timeline: [],
        createdAt: nowIso,
        source: 'form'
      }),
      formData: params.formData,
      uploadedDocuments: params.uploadedDocuments,
      updatedAt: nowIso
    } as Application;
    state.applications = existing
      ? state.applications.map(a => (a.id === draft.id ? draft : a))
      : [draft, ...state.applications];
    saveApps(draft.id);
    notify();
    return draft;
  },

  deleteDraft(id: string) {
    const app = state.applications.find(a => a.id === id);
    if (!app || app.status !== 'draft' || app.studentId !== state.currentUser.id) return;
    state.applications = state.applications.filter(a => a.id !== id);
    safeSave(K.APPLICATIONS, state.applications);
    if (cloudWritable()) cloud.deleteApplication(id);
    notify();
  },

  async createApplication(params: {
    applicationTypeId: string;
    formData: Record<string, any>;
    uploadedDocuments: UploadedDocument[];
    designationIds: string[];
    source?: 'form' | 'upload';
    scan?: Application['scan'];
    draftId?: string;
  }): Promise<Application> {
    const me = state.currentUser;
    if (me.role !== 'student') throw new Error('Only students can send requests.');
    const type = state.applicationTypes.find(t => t.id === params.applicationTypeId);
    if (!type) throw new Error('Form not found');
    if (!params.designationIds.length) throw new Error('Add at least one signer to the approval chain.');

    const now = new Date();
    const nowIso = now.toISOString();
    const stages = stagesFromDesignations(params.designationIds);
    stages[0] = { ...stages[0], status: 'in_progress', startedAt: nowIso, deadline: addBusinessHours(now, stages[0].slaHours).toISOString() };
    const referenceNumber = nextReference();
    const chainText = stages.map(s => shortTitle(s.assignedRole)).join(' → ');

    const app: Application = {
      id: uid('app'),
      referenceNumber,
      applicationTypeId: type.id,
      applicationTypeTitle: type.title,
      templateVersion: type.publishedVersion,
      studentId: me.id,
      studentSnapshot: { name: me.name, registrationNumber: me.registrationNumber || '', email: me.email, department: me.department, phone: me.phone },
      status: 'pending_signature',
      currentStageId: stages[0].stageId,
      currentStageIndex: 0,
      formData: params.formData,
      uploadedDocuments: params.uploadedDocuments,
      stageInstances: stages,
      timeline: [
        event({ stageName: 'Submission', title: 'Submitted by you', description: `chain: ${chainText}`, actorName: me.name, actorRole: 'student', type: 'submission' }),
        event({ stageName: stages[0].name, title: `Sent to ${stages[0].assignedStaffName} (${stages[0].assignedRole})`, description: '', actorName: 'EzScene', actorRole: 'system', type: 'verification' })
      ],
      createdAt: nowIso,
      updatedAt: nowIso,
      submissionDate: nowIso,
      targetDeadline: addBusinessHours(now, stages.length * 24).toISOString(),
      source: params.source || 'form',
      scan: params.scan
    };

    state.applications = [app, ...state.applications.filter(a => a.id !== params.draftId)];
    saveApps(app.id);
    if (params.draftId && cloudWritable()) cloud.deleteApplication(params.draftId);

    this.addAuditLog('APPLICATION_SUBMISSION', `${referenceNumber} · ${type.title} · chain ${chainText}${params.scan?.edited ? ' (edited by student)' : ''}`, referenceNumber);
    this.addNotification({ userId: me.id, title: `Request sent · ${referenceNumber}`, message: `Your ${type.title} is on ${stages[0].assignedStaffName}'s desk.`, type: 'info', read: false, applicationRef: referenceNumber });
    this.addNotification({ userId: stages[0].assignedStaffId!, title: `New request from ${me.name}`, message: `${type.title} is waiting for your signature.`, type: 'info', read: false, applicationRef: referenceNumber });
    notify();
    return app;
  },

  /** Record that the assignee opened the request (shown in the student's activity). */
  markOpened(applicationId: string) {
    const app = state.applications.find(a => a.id === applicationId);
    const me = state.currentUser;
    if (!app) return;
    const stage = currentStage(app);
    if (!stage || stage.status !== 'in_progress' || stage.assignedStaffId !== me.id || stage.openedAt) return;
    const nowIso = new Date().toISOString();
    updateApp(app.id, a => ({
      ...a,
      stageInstances: a.stageInstances.map((s, i) => (i === a.currentStageIndex ? { ...s, openedAt: nowIso } : s)),
      timeline: [...a.timeline, event({ stageName: stage.name, title: `Opened by ${me.name}`, description: '', actorName: me.name, actorRole: stage.assignedRole, type: 'opened' })]
    }));
    notify();
  },

  reviewDocument(params: { applicationId: string; documentId: string; status: 'verified' | 'rejected'; rejectionReason?: string }) {
    updateApp(params.applicationId, a => ({
      ...a,
      uploadedDocuments: a.uploadedDocuments.map(d =>
        d.id === params.documentId ? { ...d, status: params.status, rejectionReason: params.rejectionReason, verifiedBy: state.currentUser.name, verifiedAt: new Date().toISOString() } : d
      )
    }));
    notify();
  },

  async processStageDecision(params: { applicationId: string; action: 'approve' | 'reject' | 'request_correction'; decisionNotes: string }): Promise<Application> {
    const app = state.applications.find(a => a.id === params.applicationId);
    if (!app) throw new Error('Request not found');
    const me = state.currentUser;
    const stage = { ...currentStage(app) };
    if (!stage || stage.status !== 'in_progress') throw new Error('This request is not waiting on anyone right now.');
    if (!canSignStage(me, stage)) throw new Error('Only the person this stage is assigned to can decide on it.');
    const type = state.applicationTypes.find(t => t.id === app.applicationTypeId);
    const designation = state.designations.find(d => d.id === stage.designationId);
    const now = new Date();
    const nowIso = now.toISOString();
    const stages = [...app.stageInstances];
    const timeline = [...app.timeline];

    if (params.action === 'reject') {
      if (!params.decisionNotes.trim()) throw new Error('Give the student a reason for rejecting.');
      stages[app.currentStageIndex] = { ...stage, status: 'rejected', completedAt: nowIso, decisionNotes: params.decisionNotes, actionTakenBy: me.name };
      timeline.push(event({ stageName: stage.name, title: `Rejected by ${me.name} (${stage.assignedRole})`, description: `Reason: ${params.decisionNotes}`, actorName: me.name, actorRole: stage.assignedRole, type: 'rejection' }));
      const rejected: Application = { ...app, status: 'rejected', stageInstances: stages, timeline, updatedAt: nowIso };
      state.applications = state.applications.map(a => (a.id === app.id ? rejected : a));
      saveApps(app.id);
      this.addAuditLog('APPLICATION_REJECTED', `${app.referenceNumber} · ${app.applicationTypeTitle} — ${params.decisionNotes}`, app.referenceNumber);
      this.addNotification({ userId: app.studentId, title: `${app.applicationTypeTitle} was rejected`, message: `${me.name} (${stage.assignedRole}): "${params.decisionNotes}"`, type: 'alert', read: false, applicationRef: app.referenceNumber });
      notify();
      return rejected;
    }

    if (params.action === 'request_correction') {
      if (!params.decisionNotes.trim()) throw new Error('Tell the student what to change.');
      stages[app.currentStageIndex] = { ...stage, decisionNotes: params.decisionNotes };
      timeline.push(event({ stageName: stage.name, title: `Changes requested by ${me.name}`, description: params.decisionNotes, actorName: me.name, actorRole: stage.assignedRole, type: 'correction_request' }));
      const paused: Application = { ...app, status: 'awaiting_student_action', correctionRequestNote: params.decisionNotes, stageInstances: stages, timeline, updatedAt: nowIso };
      state.applications = state.applications.map(a => (a.id === app.id ? paused : a));
      saveApps(app.id);
      this.addAuditLog('CORRECTION_REQUESTED', `${app.referenceNumber} — ${params.decisionNotes}`, app.referenceNumber);
      this.addNotification({ userId: app.studentId, title: `Changes requested on your ${app.applicationTypeTitle}`, message: `${me.name}: "${params.decisionNotes}"`, type: 'warning', read: false, applicationRef: app.referenceNumber });
      notify();
      return paused;
    }

    // Approve & sign with the approver's own saved signature.
    const signature = ownSignature(me, state.signatures);
    if (!signature) throw new Error('Add your signature in Profile before approving.');
    const seal = sealFor(designation, state.stamps);
    stages[app.currentStageIndex] = {
      ...stage,
      status: 'completed',
      completedAt: nowIso,
      decisionNotes: params.decisionNotes || 'Approved',
      actionTakenBy: me.name,
      signatureApplied: true,
      signatureAssetUrl: signature.imageUrl,
      stampApplied: Boolean(seal),
      stampAssetUrl: seal?.imageUrl
    };
    timeline.push(
      event({ stageName: stage.name, title: `Approved and signed by ${me.name} (${stage.assignedRole})`, description: `signature stamped on page 1${seal ? ' · department seal affixed' : ''}`, actorName: me.name, actorRole: stage.assignedRole, type: 'signature' })
    );
    this.addAuditLog('STAGE_SIGNED', `${app.referenceNumber} · ${app.applicationTypeTitle}`, app.referenceNumber);

    const nextIndex = app.currentStageIndex + 1;
    if (nextIndex < stages.length) {
      const next = { ...stages[nextIndex], status: 'in_progress' as const, startedAt: nowIso, deadline: addBusinessHours(now, stages[nextIndex].slaHours).toISOString() };
      stages[nextIndex] = next;
      timeline.push(event({ stageName: next.name, title: `Sent to ${next.assignedStaffName} (${next.assignedRole})`, description: '', actorName: 'EzScene', actorRole: 'system', type: 'verification' }));
      const advanced: Application = { ...app, status: 'pending_signature', currentStageIndex: nextIndex, currentStageId: next.stageId, stageInstances: stages, timeline, updatedAt: nowIso };
      state.applications = state.applications.map(a => (a.id === app.id ? advanced : a));
      saveApps(app.id);
      this.addNotification({ userId: app.studentId, title: `Signed by ${me.name}`, message: `Your ${app.applicationTypeTitle} is now on ${next.assignedStaffName}'s desk (${next.assignedRole}).`, type: 'info', read: false, applicationRef: app.referenceNumber });
      if (next.assignedStaffId) {
        this.addNotification({ userId: next.assignedStaffId, title: `New request from ${app.studentSnapshot.name}`, message: `${app.applicationTypeTitle} is waiting for your signature.`, type: 'info', read: false, applicationRef: app.referenceNumber });
      }
      notify();
      return advanced;
    }

    // Final signature: issue the stamped document.
    const student = userById(app.studentId);
    const studentSig = type?.documentTemplate.includeStudentSignature && student ? ownSignature(student, state.signatures) : undefined;
    const documentHash = await calculateDocumentHash(`${app.referenceNumber}|${JSON.stringify(app.formData)}|${stages.map(s => `${s.actionTakenBy}@${s.completedAt}`).join(',')}`);
    const issued = {
      id: uid('doc'),
      documentNumber: app.referenceNumber,
      referenceNumber: app.referenceNumber,
      generatedAt: nowIso,
      verificationCode: app.referenceNumber,
      documentHash,
      appliedSignatures: [
        ...(studentSig ? [{ slotId: 'student', staffName: app.studentSnapshot.name, roleTitle: 'Student', timestamp: app.submissionDate || nowIso, signatureUrl: studentSig.imageUrl }] : []),
        ...stages.filter(s => s.signatureApplied && s.signatureAssetUrl).map(s => ({ slotId: s.stageId, staffName: s.actionTakenBy || s.assignedStaffName || '', roleTitle: s.assignedRole, timestamp: s.completedAt || nowIso, signatureUrl: s.signatureAssetUrl! }))
      ],
      appliedStamps: stages.filter(s => s.stampApplied && s.stampAssetUrl).map(s => ({ slotId: s.stageId, stampName: `${s.assignedDepartment} seal`, timestamp: s.completedAt || nowIso, stampUrl: s.stampAssetUrl! }))
    } as NonNullable<Application['issuedDocument']>;

    timeline.push(event({ stageName: 'Issued', title: 'Fully approved · stamped PDF ready', description: `All ${stages.length} signatures stamped`, actorName: 'EzScene', actorRole: 'system', type: 'issuance' }));
    let completed: Application = { ...app, status: 'completed', stageInstances: stages, timeline, issuedDocument: issued, updatedAt: nowIso };
    const pkg = await buildIssuedPackage(completed, type?.documentTemplate);
    if (pkg) {
      completed = {
        ...completed,
        issuedDocument: { ...issued, pdfDataUrl: pkg.dataUrl, pdfVersion: PDF_RENDER_VERSION, pdfFileHash: await sha256Bytes(dataUrlToBytes(pkg.dataUrl)), pageCount: pkg.pageCount }
      };
    }
    state.applications = state.applications.map(a => (a.id === app.id ? completed : a));
    saveApps(app.id);
    this.addAuditLog('DOCUMENT_ISSUED', `${app.referenceNumber} · ${app.applicationTypeTitle} · SHA-256 ${documentHash.slice(0, 4)}…${documentHash.slice(-4)}`, app.referenceNumber);
    this.addNotification({ userId: app.studentId, title: `${app.applicationTypeTitle} is fully approved`, message: 'All signatures are stamped. Download your print-ready PDF.', type: 'success', read: false, applicationRef: app.referenceNumber });
    notify();
    return completed;
  },

  /** Student updates a request after "changes requested"; the same desk resumes. */
  resubmitCorrection(params: { applicationId: string; updatedFormData: Record<string, any>; replacementDocuments?: UploadedDocument[] }) {
    const app = state.applications.find(a => a.id === params.applicationId);
    if (!app || app.studentId !== state.currentUser.id) return;
    const stage = currentStage(app);
    updateApp(app.id, a => ({
      ...a,
      status: 'pending_signature',
      formData: { ...a.formData, ...params.updatedFormData },
      uploadedDocuments: params.replacementDocuments || a.uploadedDocuments,
      correctionRequestNote: undefined,
      timeline: [...a.timeline, event({ stageName: stage?.name || '', title: 'Updated and resubmitted by you', description: '', actorName: state.currentUser.name, actorRole: 'student', type: 'submission' })],
      updatedAt: new Date().toISOString()
    }));
    this.addAuditLog('CORRECTION_RESUBMITTED', `${app.referenceNumber} updated by student`, app.referenceNumber);
    if (stage?.assignedStaffId) {
      this.addNotification({ userId: stage.assignedStaffId, title: `${app.studentSnapshot.name} updated their request`, message: `${app.applicationTypeTitle} is back on your desk.`, type: 'info', read: false, applicationRef: app.referenceNumber });
    }
    notify();
  },

  canRemind(app: Application): { ok: boolean; reason?: string } {
    const stage = currentStage(app);
    if (!stage || stage.status !== 'in_progress' || !LIVE.includes(app.status)) return { ok: false, reason: 'Nothing is waiting right now.' };
    const since = new Date(stage.lastReminderAt || stage.startedAt || app.submissionDate || app.createdAt).getTime();
    if (Date.now() - since < 24 * 3600 * 1000) return { ok: false, reason: 'Reminders unlock after 24 hours on one desk.' };
    return { ok: true };
  },

  sendReminder(applicationId: string): { ok: boolean; error?: string } {
    const app = state.applications.find(a => a.id === applicationId);
    if (!app || app.studentId !== state.currentUser.id) return { ok: false, error: 'Request not found.' };
    const check = this.canRemind(app);
    if (!check.ok) return { ok: false, error: check.reason };
    const stage = currentStage(app);
    const nowIso = new Date().toISOString();
    updateApp(app.id, a => ({
      ...a,
      stageInstances: a.stageInstances.map((s, i) => (i === a.currentStageIndex ? { ...s, lastReminderAt: nowIso } : s)),
      timeline: [...a.timeline, event({ stageName: stage.name, title: `Reminder sent to ${stage.assignedStaffName}`, description: '', actorName: state.currentUser.name, actorRole: 'student', type: 'reminder' })]
    }));
    this.addNotification({ userId: stage.assignedStaffId!, title: `Reminder: ${app.studentSnapshot.name} is waiting`, message: `${app.applicationTypeTitle} (${app.referenceNumber}) has been on your desk for over a day.`, type: 'warning', read: false, applicationRef: app.referenceNumber });
    this.addAuditLog('REMINDER_SENT', `${app.referenceNumber} → ${stage.assignedStaffName}`, app.referenceNumber);
    return { ok: true };
  },

  withdrawApplication(applicationId: string): { ok: boolean; error?: string } {
    const app = state.applications.find(a => a.id === applicationId);
    if (!app || app.studentId !== state.currentUser.id) return { ok: false, error: 'Request not found.' };
    if (!LIVE.includes(app.status)) return { ok: false, error: 'Only requests in progress can be withdrawn.' };
    const stage = currentStage(app);
    updateApp(app.id, a => ({
      ...a,
      status: 'cancelled',
      timeline: [...a.timeline, event({ stageName: stage?.name || '', title: 'Withdrawn by you', description: '', actorName: state.currentUser.name, actorRole: 'student', type: 'withdrawn' })],
      updatedAt: new Date().toISOString()
    }));
    if (stage?.assignedStaffId) {
      this.addNotification({ userId: stage.assignedStaffId, title: `${app.studentSnapshot.name} withdrew a request`, message: `${app.applicationTypeTitle} (${app.referenceNumber}) no longer needs your signature.`, type: 'info', read: false, applicationRef: app.referenceNumber });
    }
    this.addAuditLog('APPLICATION_WITHDRAWN', `${app.referenceNumber} · ${app.applicationTypeTitle}`, app.referenceNumber);
    notify();
    return { ok: true };
  },

  /** Render (and store) the issued PDF if it is missing or from an older renderer. */
  async ensureIssuedPdf(applicationId: string): Promise<Application | undefined> {
    const app = state.applications.find(a => a.id === applicationId);
    if (!app?.issuedDocument) return app;
    if (app.issuedDocument.pdfDataUrl && app.issuedDocument.pdfFileHash) return app;
    const type = state.applicationTypes.find(t => t.id === app.applicationTypeId);
    const pkg = await buildIssuedPackage(app, type?.documentTemplate);
    if (!pkg) return app;
    const fileHash = await sha256Bytes(dataUrlToBytes(pkg.dataUrl));
    updateApp(app.id, a => ({ ...a, issuedDocument: { ...a.issuedDocument!, pdfDataUrl: pkg.dataUrl, pdfVersion: PDF_RENDER_VERSION, pdfFileHash: fileHash, pageCount: pkg.pageCount } }));
    notify();
    return state.applications.find(a => a.id === applicationId);
  },

  /** Public verification by document ID. */
  findIssued(code: string): Application | undefined {
    const c = code.trim().toUpperCase();
    return state.applications.find(a => a.issuedDocument && (a.issuedDocument.verificationCode.toUpperCase() === c || a.referenceNumber.toUpperCase() === c));
  },

  /** Verify an uploaded PDF by its exact SHA-256 fingerprint. */
  async verifyPdfBytes(bytes: ArrayBuffer): Promise<Application | undefined> {
    const hash = await sha256Bytes(bytes);
    return state.applications.find(a => a.issuedDocument?.pdfFileHash === hash);
  },

  recordVerification(code: string, ok: boolean) {
    this.addAuditLog(ok ? 'DOCUMENT_VERIFIED' : 'VERIFICATION_FAILED', `${code} ${ok ? 'matched its record' : 'did not match any record'}`, ok ? code : undefined);
  },

  /* ---------------------------------------------------------- signatures */

  saveOwnSignature(dataUrl: string, source: 'draw' | 'upload') {
    const me = state.currentUser;
    const nowIso = new Date().toISOString();
    const asset: SignatureAsset = {
      id: uid('sig'),
      name: `${me.name} — signature`,
      type: 'signature',
      imageUrl: dataUrl,
      originalImageUrl: dataUrl,
      ownerName: me.name,
      ownerId: me.id,
      ownerRole: me.designation || (me.role === 'student' ? 'Student' : me.role),
      department: me.department,
      isTransparent: true,
      opacity: 1,
      active: true,
      createdAt: nowIso,
      auditHash: sha256(dataUrl)
    };
    const retired = state.signatures.filter(s => s.active && (s.ownerId === me.id || (!s.ownerId && s.ownerName === me.name))).map(s => ({ ...s, active: false }));
    state.signatures = [asset, ...state.signatures.map(s => retired.find(r => r.id === s.id) || s)];
    safeSave(K.SIGNATURES, state.signatures);
    if (cloudWritable()) {
      markSelfPush();
      [asset, ...retired].forEach(s => cloud.pushSignature(s));
    }
    this.addAuditLog('SIGNATURE_UPDATED', `${me.name} saved a new signature (${source === 'draw' ? 'drawn' : 'uploaded PNG'})`);
    notify();
  },

  /* -------------------------------------------------------- designations */

  addDesignation(input: Omit<Designation, 'id' | 'order' | 'since'> & { since?: string }) {
    const d: Designation = { ...input, id: uid('des'), since: input.since || new Date().toISOString().slice(0, 10), order: state.designations.length + 1 };
    state.designations = [...state.designations, d];
    saveDesignations(d.id);
    this.addAuditLog('DESIGNATION_ADDED', `${d.title} (${d.department})${d.holderId ? ` → ${userById(d.holderId)?.name}` : ''}`);
    notify();
    return d;
  },

  updateDesignation(id: string, changes: Partial<Designation>) {
    state.designations = state.designations.map(d => (d.id === id ? { ...d, ...changes } : d));
    saveDesignations(id);
    const d = state.designations.find(x => x.id === id);
    this.addAuditLog('DESIGNATION_UPDATED', `${d?.title} (${d?.department}) updated`);
    notify();
  },

  /**
   * Leadership change: the designation moves to a new person. Pending and
   * in-progress stages follow it; signatures already applied stay with the
   * person who signed.
   */
  reassignDesignation(id: string, newHolderId: string) {
    const d = state.designations.find(x => x.id === id);
    const holder = userById(newHolderId);
    if (!d || !holder) return 0;
    if (d.holderId === newHolderId) return 0;
    const previous = userById(d.holderId);
    const nowIso = new Date().toISOString();
    state.designations = state.designations.map(x => (x.id === id ? { ...x, holderId: newHolderId, since: nowIso.slice(0, 10) } : x));
    saveDesignations(id);

    let moved = 0;
    const touched: string[] = [];
    state.applications = state.applications.map(app => {
      if (!LIVE.includes(app.status)) return app;
      let changed = false;
      const stageInstances = app.stageInstances.map(s => {
        if (s.designationId === id && (s.status === 'pending' || s.status === 'in_progress')) {
          changed = true;
          if (s.status === 'in_progress') moved += 1;
          return { ...s, assignedStaffId: holder.id, assignedStaffName: holder.name, openedAt: undefined };
        }
        return s;
      });
      if (!changed) return app;
      touched.push(app.id);
      return { ...app, stageInstances };
    });
    saveApps(...touched);

    const typeIds: string[] = [];
    state.applicationTypes = state.applicationTypes.map(t => {
      if (!t.workflowDefinition.stages.some(s => s.designationId === id)) return t;
      typeIds.push(t.id);
      return { ...t, workflowDefinition: { ...t.workflowDefinition, stages: t.workflowDefinition.stages.map(s => (s.designationId === id ? { ...s, assignedStaffId: holder.id } : s)) } };
    });
    saveTypes(...typeIds);

    if (!holder.designation || holder.designation === 'Faculty') {
      this.updateUser(holder.id, { designation: d.title }, 'USER_UPDATED', `${holder.name} now holds ${d.title}`);
    }
    this.addAuditLog('ROLE_CHANGED', `${d.title} (${d.department}): ${previous?.name || 'vacant'} → ${holder.name}`);
    if (moved > 0) {
      this.addNotification({ userId: holder.id, title: `You are now ${d.title}`, message: `${moved} pending request${moved === 1 ? '' : 's'} moved to your inbox.`, type: 'info', read: false });
    }
    notify();
    return moved;
  },

  deleteDesignation(id: string): { ok: boolean; error?: string } {
    const live = state.applications.some(a => LIVE.includes(a.status) && a.stageInstances.some(s => s.designationId === id && s.status !== 'completed'));
    if (live) return { ok: false, error: 'Requests are still waiting on this designation. Reassign it instead.' };
    const d = state.designations.find(x => x.id === id);
    state.designations = state.designations.filter(x => x.id !== id);
    safeSave(K.DESIGNATIONS, state.designations);
    if (cloudWritable()) cloud.deleteDesignation(id);
    this.addAuditLog('DESIGNATION_REMOVED', `${d?.title} (${d?.department})`);
    notify();
    return { ok: true };
  },

  /* ----------------------------------------------------------- templates */

  saveApplicationType(next: ApplicationType, opts: { bumpVersion: boolean }) {
    const prev = state.applicationTypes.find(t => t.id === next.id);
    const nowIso = new Date().toISOString();
    let saved = { ...next, updatedAt: nowIso };
    if (prev && opts.bumpVersion) {
      const v = prev.publishedVersion + 1;
      saved = {
        ...saved,
        publishedVersion: v,
        formConfig: { ...saved.formConfig, version: v, title: saved.title },
        documentTemplate: { ...saved.documentTemplate, version: v, updatedAt: nowIso },
        workflowDefinition: { ...saved.workflowDefinition, version: v }
      };
    }
    state.applicationTypes = prev ? state.applicationTypes.map(t => (t.id === saved.id ? saved : t)) : [...state.applicationTypes, saved];
    saveTypes(saved.id);
    this.addAuditLog(prev ? 'TEMPLATE_UPDATED' : 'TEMPLATE_CREATED', prev && opts.bumpVersion ? `${saved.title} v${prev.publishedVersion} → v${saved.publishedVersion}` : `${saved.title} v${saved.publishedVersion}`);
    notify();
    return saved;
  },

  setTypeActive(id: string, active: boolean) {
    const t = state.applicationTypes.find(x => x.id === id);
    if (!t) return;
    state.applicationTypes = state.applicationTypes.map(x => (x.id === id ? { ...x, active, updatedAt: new Date().toISOString() } : x));
    saveTypes(id);
    this.addAuditLog('TEMPLATE_UPDATED', `${t.title} ${active ? 'activated' : 'retired'}`);
    notify();
  },

  /* ---------------------------------------------------------- operations */

  triggerSLACheck() {
    const result = runSLASchedulerCheck(
      state.applications,
      updated => {
        state.applications = state.applications.map(a => (a.id === updated.id ? updated : a));
        saveApps(updated.id);
      },
      n => this.addNotification(n)
    );
    this.addAuditLog('SLA_CHECK', `Checked ${result.checkedCount} open requests · ${result.warningsGenerated} warnings · ${result.escalationsTriggered} escalations`);
    notify();
    return result;
  },

  async connectCloud(url: string, anonKey: string): Promise<{ ok: boolean; error?: string }> {
    const probe = await probeConnection(url, anonKey);
    if (!probe.ok) return { ok: false, error: probe.message };
    const saved = saveCloudConfig(url, anonKey);
    if (!saved.ok) return { ok: false, error: saved.error };
    unsubscribeRealtime?.();
    unsubscribeRealtime = null;
    cloudSyncStarted = false;
    const ok = await ensureCloudSync();
    if (!ok) return { ok: false, error: 'Connected, but data could not be loaded. Run supabase/schema.sql in the SQL editor.' };
    this.addAuditLog('CLOUD_CONNECTED', 'Supabase project connected');
    return { ok: true };
  },

  disconnectCloud() {
    clearCloudConfig();
    unsubscribeRealtime?.();
    unsubscribeRealtime = null;
    cloudSyncStarted = false;
    state.cloudStatus = 'local';
    this.addAuditLog('CLOUD_DISCONNECTED', 'Supabase disconnected; running on browser storage');
    notify();
  },

  resetToDefaults() {
    Object.values(K).forEach(k => {
      try {
        if (k !== K.SEED) localStorage.removeItem(k);
      } catch {
        /* ignore */
      }
    });
    state = {
      ...state,
      isAuthenticated: false,
      currentUser: INITIAL_USERS[0],
      users: INITIAL_USERS,
      applicationTypes: INITIAL_APPLICATION_TYPES,
      applications: INITIAL_APPLICATIONS,
      signatures: INITIAL_SIGNATURES,
      stamps: INITIAL_STAMPS,
      auditLogs: chainLogs(INITIAL_AUDIT_LOGS),
      notifications: INITIAL_NOTIFICATIONS,
      designations: INITIAL_DESIGNATIONS,
      prefs: {}
    };
    persistAll();
    notify();
    if (cloudWritable()) {
      void (async () => {
        try {
          await wipeCloud();
          await pushAll({
            users: INITIAL_USERS,
            applicationTypes: INITIAL_APPLICATION_TYPES,
            applications: INITIAL_APPLICATIONS,
            signatures: INITIAL_SIGNATURES,
            stamps: INITIAL_STAMPS,
            auditLogs: state.auditLogs,
            notifications: INITIAL_NOTIFICATIONS,
            designations: INITIAL_DESIGNATIONS
          });
          markSelfPush();
        } catch {
          toast('warning', 'Cloud reset failed', 'Local data was reset, but the cloud database could not be reached.');
        }
      })();
    }
  },

  initCloudSync: ensureCloudSync
};

type Store = typeof EzStore;
const bound = Object.fromEntries(
  Object.entries(EzStore)
    .filter(([, v]) => typeof v === 'function')
    .map(([k, v]) => [k, (v as Function).bind(EzStore)])
) as { [P in keyof Store as Store[P] extends Function ? P : never]: Store[P] };

/** React hook: subscribe to store updates. */
export function useStore() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const handler = () => setTick(t => t + 1);
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);
  return { ...state, ...bound };
}

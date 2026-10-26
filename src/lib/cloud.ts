/**
 * EzScene Cloud Sync Layer
 * All Supabase read/write logic lives here. The reactive store calls these
 * functions opportunistically: when Supabase is configured, every mutation is
 * written through to the cloud and remote changes are pulled back in realtime.
 * When not configured, every call is a safe no-op.
 */

import {
  UserProfile,
  ApplicationType,
  Application,
  SignatureAsset,
  StampAsset,
  AuditLog,
  NotificationItem,
  Designation
} from '../types';
import {
  INITIAL_USERS,
  INITIAL_APPLICATION_TYPES,
  INITIAL_APPLICATIONS,
  INITIAL_SIGNATURES,
  INITIAL_STAMPS,
  INITIAL_DESIGNATIONS
} from './constants';
import { getSupabase, isCloudConfigured } from './supabase';

export interface CloudData {
  users: UserProfile[];
  applicationTypes: ApplicationType[];
  applications: Application[];
  signatures: SignatureAsset[];
  stamps: StampAsset[];
  auditLogs: AuditLog[];
  notifications: NotificationItem[];
  designations: Designation[];
}

/** Tables that make up the EzScene schema, in display order. */
export const CLOUD_TABLES = [
  { table: 'profiles', label: 'User accounts' },
  { table: 'application_types', label: 'Application types & templates' },
  { table: 'applications', label: 'Applications' },
  { table: 'signature_assets', label: 'Signature assets' },
  { table: 'stamp_assets', label: 'Official seals' },
  { table: 'audit_logs', label: 'Audit trail' },
  { table: 'notifications', label: 'Notifications' },
  { table: 'designations', label: 'Designations' }
] as const;

export interface TableStat {
  table: string;
  label: string;
  count: number | null;
  error?: string;
}

/**
 * Resolve the active client, or throw a message the UI can display.
 * Keeping this in one place means connecting/disconnecting at runtime is
 * picked up by every write path automatically.
 */
function db() {
  const client = getSupabase();
  if (!client) {
    throw new Error('Supabase is not configured.');
  }
  return client;
}

let onCloudError: ((message: string) => void) | null = null;
export function setCloudErrorHandler(handler: (message: string) => void) {
  onCloudError = handler;
}

function reportError(context: string, error: { message?: string } | null) {
  const message = `${context}${error?.message ? `: ${error.message}` : ''}`;
  console.warn(`[EzScene Cloud] ${message}`);
  onCloudError?.(message);
}

/* ------------------------------------------------------------------ */
/* Row mappers (app camelCase <-> database snake_case)                 */
/* ------------------------------------------------------------------ */

type Row = Record<string, any>;

const mapProfile = {
  toRow: (u: UserProfile): Row => ({
    id: u.id,
    name: u.name,
    email: u.email.toLowerCase(),
    password: u.password || '123',
    role: u.role,
    avatar_url: u.avatarUrl ?? null,
    registration_number: u.registrationNumber ?? null,
    department: u.department,
    designation: u.designation ?? null,
    phone: u.phone,
    semester: u.semester ?? null,
    hostel_room: u.hostelRoom ?? null,
    active: u.active
  }),
  fromRow: (r: Row): UserProfile => ({
    id: r.id,
    name: r.name,
    email: r.email,
    password: r.password,
    role: r.role,
    avatarUrl: r.avatar_url ?? undefined,
    registrationNumber: r.registration_number ?? undefined,
    department: r.department,
    designation: r.designation ?? undefined,
    phone: r.phone,
    semester: r.semester ?? undefined,
    hostelRoom: r.hostel_room ?? undefined,
    active: r.active
  })
};

const mapApplicationType = {
  toRow: (t: ApplicationType): Row => ({
    id: t.id,
    key: t.key,
    title: t.title,
    description: t.description,
    category: t.category,
    icon: t.icon,
    estimated_duration_days: t.estimatedDurationDays,
    active: t.active,
    published_version: t.publishedVersion,
    form_config: t.formConfig,
    document_template: t.documentTemplate,
    workflow_definition: t.workflowDefinition,
    draft_form_config: t.draftFormConfig ?? null,
    has_unpublished_draft: t.hasUnpublishedDraft ?? false,
    tag: t.tag ?? null,
    updated_at: t.updatedAt || new Date().toISOString()
  }),
  fromRow: (r: Row): ApplicationType => ({
    id: r.id,
    key: r.key,
    title: r.title,
    description: r.description,
    category: r.category,
    icon: r.icon,
    estimatedDurationDays: r.estimated_duration_days,
    active: r.active,
    publishedVersion: r.published_version,
    formConfig: r.form_config,
    documentTemplate: r.document_template,
    workflowDefinition: r.workflow_definition,
    draftFormConfig: r.draft_form_config ?? undefined,
    hasUnpublishedDraft: r.has_unpublished_draft ?? false,
    tag: r.tag ?? undefined,
    updatedAt: r.updated_at ?? undefined
  })
};

const mapApplication = {
  toRow: (a: Application): Row => ({
    id: a.id,
    reference_number: a.referenceNumber,
    application_type_id: a.applicationTypeId,
    application_type_title: a.applicationTypeTitle,
    template_version: a.templateVersion,
    student_id: a.studentId,
    student_snapshot: a.studentSnapshot,
    status: a.status,
    current_stage_id: a.currentStageId,
    current_stage_index: a.currentStageIndex,
    form_data: a.formData,
    uploaded_documents: a.uploadedDocuments,
    payment_record: a.paymentRecord ?? null,
    stage_instances: a.stageInstances,
    timeline: a.timeline,
    issued_document: a.issuedDocument ?? null,
    source: a.source ?? 'form',
    scan: a.scan ?? null,
    correction_request_note: a.correctionRequestNote ?? null,
    created_at: a.createdAt,
    updated_at: a.updatedAt,
    submission_date: a.submissionDate ?? null,
    estimated_completion_date: a.estimatedCompletionDate ?? null,
    target_deadline: a.targetDeadline ?? null
  }),
  fromRow: (r: Row): Application => ({
    id: r.id,
    referenceNumber: r.reference_number,
    applicationTypeId: r.application_type_id,
    applicationTypeTitle: r.application_type_title,
    templateVersion: r.template_version,
    studentId: r.student_id,
    studentSnapshot: r.student_snapshot,
    status: r.status,
    currentStageId: r.current_stage_id,
    currentStageIndex: r.current_stage_index,
    formData: r.form_data ?? {},
    uploadedDocuments: r.uploaded_documents ?? [],
    paymentRecord: r.payment_record ?? undefined,
    stageInstances: r.stage_instances ?? [],
    timeline: r.timeline ?? [],
    issuedDocument: r.issued_document ?? undefined,
    correctionRequestNote: r.correction_request_note ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    submissionDate: r.submission_date ?? undefined,
    estimatedCompletionDate: r.estimated_completion_date ?? undefined,
    targetDeadline: r.target_deadline ?? undefined,
    source: r.source ?? 'form',
    scan: r.scan ?? undefined
  })
};

const mapSignature = {
  toRow: (s: SignatureAsset): Row => ({
    id: s.id,
    name: s.name,
    image_url: s.imageUrl,
    original_image_url: s.originalImageUrl,
    owner_name: s.ownerName,
    owner_id: s.ownerId ?? null,
    owner_role: s.ownerRole,
    department: s.department,
    is_transparent: s.isTransparent,
    opacity: s.opacity,
    active: s.active,
    created_at: s.createdAt,
    audit_hash: s.auditHash
  }),
  fromRow: (r: Row): SignatureAsset => ({
    id: r.id,
    name: r.name,
    type: 'signature',
    imageUrl: r.image_url,
    originalImageUrl: r.original_image_url,
    ownerName: r.owner_name,
    ownerId: r.owner_id ?? undefined,
    ownerRole: r.owner_role,
    department: r.department,
    isTransparent: r.is_transparent,
    opacity: r.opacity,
    active: r.active,
    createdAt: r.created_at,
    auditHash: r.audit_hash
  })
};

const mapStamp = {
  toRow: (s: StampAsset): Row => ({
    id: s.id,
    name: s.name,
    image_url: s.imageUrl,
    original_image_url: s.originalImageUrl,
    department: s.department,
    is_transparent: s.isTransparent,
    opacity: s.opacity,
    active: s.active,
    created_at: s.createdAt,
    audit_hash: s.auditHash
  }),
  fromRow: (r: Row): StampAsset => ({
    id: r.id,
    name: r.name,
    type: 'stamp',
    imageUrl: r.image_url,
    originalImageUrl: r.original_image_url,
    department: r.department,
    isTransparent: r.is_transparent,
    opacity: r.opacity,
    active: r.active,
    createdAt: r.created_at,
    auditHash: r.audit_hash
  })
};

const mapAuditLog = {
  toRow: (l: AuditLog): Row => ({
    id: l.id,
    timestamp: l.timestamp,
    actor_id: l.actorId,
    actor_name: l.actorName,
    actor_role: l.actorRole,
    action: l.action,
    details: l.details,
    application_ref: l.applicationRef ?? null,
    ip_address: l.ipAddress ?? null,
    prev_hash: l.prevHash ?? null,
    entry_hash: l.entryHash ?? null
  }),
  fromRow: (r: Row): AuditLog => ({
    id: r.id,
    timestamp: r.timestamp,
    actorId: r.actor_id,
    actorName: r.actor_name,
    actorRole: r.actor_role,
    action: r.action,
    details: r.details,
    applicationRef: r.application_ref ?? undefined,
    ipAddress: r.ip_address ?? undefined,
    prevHash: r.prev_hash ?? undefined,
    entryHash: r.entry_hash ?? undefined
  })
};

const mapDesignation = {
  toRow: (d: Designation): Row => ({
    id: d.id,
    title: d.title,
    department: d.department,
    scope: d.scope ?? null,
    reach: d.reach,
    holder_id: d.holderId ?? null,
    since: d.since,
    affixes_seal: d.affixesSeal,
    sort_order: d.order
  }),
  fromRow: (r: Row): Designation => ({
    id: r.id,
    title: r.title,
    department: r.department,
    scope: r.scope ?? undefined,
    reach: r.reach,
    holderId: r.holder_id ?? undefined,
    since: r.since,
    affixesSeal: r.affixes_seal,
    order: r.sort_order ?? 0
  })
};

const mapNotification = {
  toRow: (n: NotificationItem): Row => ({
    id: n.id,
    user_id: n.userId,
    title: n.title,
    message: n.message,
    type: n.type,
    read: n.read,
    created_at: n.createdAt,
    application_ref: n.applicationRef ?? null
  }),
  fromRow: (r: Row): NotificationItem => ({
    id: r.id,
    userId: r.user_id,
    title: r.title,
    message: r.message,
    type: r.type,
    read: r.read,
    createdAt: r.created_at,
    applicationRef: r.application_ref ?? undefined
  })
};

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

async function fetchTable<T>(table: string, orderBy: string, ascending: boolean, map: (r: Row) => T): Promise<T[]> {
  const { data, error } = await db().from(table).select('*').order(orderBy, { ascending });
  if (error) throw error;
  return (data ?? []).map(map);
}

/**
 * Pull the entire dataset from Supabase. Throws when unreachable so callers
 * can decide to keep their local state.
 */
export async function pullAll(): Promise<CloudData> {
  const [users, applicationTypes, applications, signatures, stamps, auditLogs, notifications, designations] =
    await Promise.all([
      fetchTable('profiles', 'created_at', true, mapProfile.fromRow),
      fetchTable('application_types', 'title', true, mapApplicationType.fromRow),
      fetchTable('applications', 'created_at', false, mapApplication.fromRow),
      fetchTable('signature_assets', 'created_at', false, mapSignature.fromRow),
      fetchTable('stamp_assets', 'created_at', false, mapStamp.fromRow),
      fetchTable('audit_logs', 'timestamp', false, mapAuditLog.fromRow),
      fetchTable('notifications', 'created_at', false, mapNotification.fromRow),
      fetchTable('designations', 'sort_order', true, mapDesignation.fromRow)
    ]);
  return { users, applicationTypes, applications, signatures, stamps, auditLogs, notifications, designations };
}

/**
 * First-run convenience: when the cloud database is completely empty, upload
 * the built-in seed dataset so a fresh Supabase project is instantly usable.
 * Returns true when seeding happened.
 */
export async function seedIfEmpty(): Promise<boolean> {
  const { count, error } = await db()
    .from('profiles')
    .select('id', { count: 'exact', head: true });
  if (error) throw error;
  if ((count ?? 0) > 0) return false;

  const seed: CloudData = {
    users: INITIAL_USERS,
    applicationTypes: INITIAL_APPLICATION_TYPES,
    applications: INITIAL_APPLICATIONS,
    signatures: INITIAL_SIGNATURES,
    stamps: INITIAL_STAMPS,
    auditLogs: [
      {
        id: `audit-seed-${Date.now()}`,
        timestamp: new Date().toISOString(),
        actorId: 'system',
        actorName: 'EzScene',
        actorRole: 'system',
        action: 'DATABASE_SEEDED',
        details: 'Initial platform data (accounts, application types, signature & stamp registry) uploaded to Supabase.'
      }
    ],
    notifications: [],
    designations: INITIAL_DESIGNATIONS
  };
  await pushAll(seed);
  return true;
}

/* ------------------------------------------------------------------ */
/* Writes (fire-and-forget upserts / deletes)                          */
/* ------------------------------------------------------------------ */

async function upsertMany(table: string, rows: Row[]) {
  if (rows.length === 0) return;
  const { error } = await db().from(table).upsert(rows, { onConflict: 'id' });
  if (error) reportError(`Failed to sync ${table}`, error);
}

async function deleteRow(table: string, id: string) {
  const { error } = await db().from(table).delete().eq('id', id);
  if (error) reportError(`Failed to delete from ${table}`, error);
}

export async function pushAll(data: CloudData) {
  await Promise.all([
    upsertMany('profiles', data.users.map(mapProfile.toRow)),
    upsertMany('application_types', data.applicationTypes.map(mapApplicationType.toRow)),
    upsertMany('applications', data.applications.map(mapApplication.toRow)),
    upsertMany('signature_assets', data.signatures.map(mapSignature.toRow)),
    upsertMany('stamp_assets', data.stamps.map(mapStamp.toRow)),
    upsertMany('audit_logs', data.auditLogs.map(mapAuditLog.toRow)),
    upsertMany('notifications', data.notifications.map(mapNotification.toRow)),
    upsertMany('designations', data.designations.map(mapDesignation.toRow))
  ]);
}

/**
 * Remove every row from every EzScene table (full factory reset).
 * Used exclusively by the administrator "reset to defaults" action.
 */
export async function wipeCloud() {
  const tables = [
    'designations',
    'notifications',
    'audit_logs',
    'applications',
    'application_types',
    'signature_assets',
    'stamp_assets',
    'profiles'
  ];
  for (const table of tables) {
    const { error } = await db().from(table).delete().neq('id', '___impossible___');
    if (error) reportError(`Failed to clear ${table}`, error);
  }
}

export const cloud = {
  /** Read live: runtime connect/disconnect is reflected immediately. */
  get enabled() {
    return isCloudConfigured();
  },

  pushUsers: (users: UserProfile[]) => upsertMany('profiles', users.map(mapProfile.toRow)),
  deleteUser: (id: string) => deleteRow('profiles', id),

  pushApplication: (app: Application) => upsertMany('applications', [mapApplication.toRow(app)]),

  pushApplicationType: (type: ApplicationType) =>
    upsertMany('application_types', [mapApplicationType.toRow(type)]),

  pushSignature: (sig: SignatureAsset) => upsertMany('signature_assets', [mapSignature.toRow(sig)]),
  pushStamp: (stamp: StampAsset) => upsertMany('stamp_assets', [mapStamp.toRow(stamp)]),

  pushAuditLog: (log: AuditLog) => upsertMany('audit_logs', [mapAuditLog.toRow(log)]),

  pushNotification: (n: NotificationItem) => upsertMany('notifications', [mapNotification.toRow(n)]),
  pushNotifications: (items: NotificationItem[]) =>
    upsertMany('notifications', items.map(mapNotification.toRow)),

  pushDesignations: (items: Designation[]) => upsertMany('designations', items.map(mapDesignation.toRow)),
  deleteDesignation: (id: string) => deleteRow('designations', id),
  deleteApplication: (id: string) => deleteRow('applications', id),

  pushApplications: (apps: Application[]) => upsertMany('applications', apps.map(mapApplication.toRow)),

  /**
   * Authenticate against the cloud `profiles` table (table-based auth because
   * this platform intentionally supports short demo passwords like "123").
   */
  async authenticate(email: string, password: string): Promise<UserProfile | null> {
    const cleanEmail = email.trim().toLowerCase();
    const { data, error } = await db()
      .from('profiles')
      .select('*')
      .ilike('email', cleanEmail)
      .limit(1);
    if (error) throw error;
    const row = data?.[0];
    if (!row) return null;
    if (row.active === false) return null;
    if ((row.password || '123') !== password) return null;
    return mapProfile.fromRow(row);
  }
};

/**
 * Row counts for every EzScene table, plus per-table errors so the admin
 * cloud page can point at the exact table that still needs the schema.
 */
export async function inspectTables(): Promise<TableStat[]> {
  const client = getSupabase();
  if (!client) {
    return CLOUD_TABLES.map(t => ({ ...t, count: null, error: 'Not connected' }));
  }

  const results = await Promise.all(
    CLOUD_TABLES.map(async ({ table, label }) => {
      try {
        // GET (not HEAD): a HEAD response has no body, so PostgREST's 404 for a
        // missing table would be swallowed and displayed as "0 rows".
        const { count, error } = await client.from(table).select('id', { count: 'exact' }).limit(1);
        if (error) return { table, label, count: null, error: error.message };
        return { table, label, count: count ?? 0 };
      } catch (error: any) {
        return { table, label, count: null, error: error?.message || 'Request failed' };
      }
    })
  );
  return results;
}

export { db as getCloudClient };

/* ------------------------------------------------------------------ */
/* Realtime                                                            */
/* ------------------------------------------------------------------ */

/**
 * Subscribe to live changes on the hot tables. The callback is debounced so a
 * burst of remote writes triggers a single re-pull.
 *
 * Supabase caches channels by topic and refuses new `postgres_changes`
 * callbacks once a topic has been subscribed — so every subscription gets a
 * unique topic, stale EzScene channels are dropped first, and any realtime
 * failure is swallowed (a live-sync problem must never block sign-in).
 */
export function subscribeToChanges(onChange: () => void): (() => void) | null {
  const client = getSupabase();
  if (!client) return null;

  try {
    // Drop channels left behind by an earlier connection attempt.
    client
      .getChannels()
      .filter(channel => channel.topic.startsWith('realtime:applyease-'))
      .forEach(channel => {
        void client.removeChannel(channel);
      });

    let timer: ReturnType<typeof setTimeout> | null = null;
    const debounced = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(onChange, 700);
    };

    const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const makeChannel = (name: string, table: string) =>
      client
        .channel(`applyease-${name}-${suffix}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, debounced);

    const channels = [
      makeChannel('applications', 'applications'),
      makeChannel('notifications', 'notifications'),
      makeChannel('profiles', 'profiles'),
      makeChannel('audit-logs', 'audit_logs'),
      makeChannel('designations', 'designations')
    ];

    channels.forEach(channel => {
      try {
        channel.subscribe();
      } catch (error) {
        console.warn('[EzScene Cloud] Realtime subscribe failed:', error);
      }
    });

    return () => {
      if (timer) clearTimeout(timer);
      channels.forEach(channel => {
        try {
          void client.removeChannel(channel);
        } catch {
          /* already gone */
        }
      });
    };
  } catch (error) {
    console.warn('[EzScene Cloud] Could not start realtime sync:', error);
    return null;
  }
}

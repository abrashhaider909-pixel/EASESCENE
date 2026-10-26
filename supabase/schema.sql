-- ============================================================================
-- ApplyEase — Supabase Database Schema
-- ============================================================================
-- HOW TO USE:
--   1. Open your Supabase project → SQL Editor → New query
--   2. Paste this entire file and click "Run"
--   3. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env (or in
--      your host's build environment), then restart or redeploy the app.
--
-- The application automatically seeds all initial data (users, application
-- types, signatures, stamps) the first time it connects to empty tables.
--
-- NOTE ON SECURITY: Row Level Security policies below are intentionally
-- permissive (anon role) because ApplyEase runs its own application-level
-- authentication against the `profiles` table. For a public production
-- deployment, restrict these policies and move to Supabase Auth.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- PROFILES (all user accounts: students, staff, administrators)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id                  text primary key,
  name                text not null,
  email               text not null unique,
  password            text not null default '123',
  role                text not null check (role in ('student', 'staff', 'admin')),
  avatar_url          text,
  registration_number text,
  department          text not null default '',
  designation         text,
  phone               text not null default '',
  semester            text,
  hostel_room         text,
  active              boolean not null default true,
  created_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- APPLICATION TYPES (form templates, document layouts, workflow definitions)
-- ---------------------------------------------------------------------------
create table if not exists public.application_types (
  id                      text primary key,
  key                     text not null,
  title                   text not null,
  description             text not null default '',
  category                text not null check (category in ('academic', 'hostel', 'administrative', 'financial')),
  icon                    text not null default 'FileText',
  estimated_duration_days integer not null default 7,
  active                  boolean not null default true,
  published_version       integer not null default 1,
  form_config             jsonb not null,
  document_template       jsonb not null,
  workflow_definition     jsonb not null,
  draft_form_config       jsonb,
  has_unpublished_draft   boolean not null default false,
  updated_at              timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- APPLICATIONS (student submissions with full workflow state)
-- ---------------------------------------------------------------------------
create table if not exists public.applications (
  id                       text primary key,
  reference_number         text not null,
  application_type_id      text not null,
  application_type_title   text not null,
  template_version         integer not null default 1,
  student_id               text not null,
  student_snapshot         jsonb not null,
  status                   text not null,
  current_stage_id         text,
  current_stage_index      integer not null default 0,
  form_data                jsonb not null default '{}'::jsonb,
  uploaded_documents       jsonb not null default '[]'::jsonb,
  payment_record           jsonb,
  stage_instances          jsonb not null default '[]'::jsonb,
  timeline                 jsonb not null default '[]'::jsonb,
  issued_document          jsonb,
  correction_request_note  text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  submission_date          timestamptz,
  estimated_completion_date timestamptz,
  target_deadline          timestamptz
);

create index if not exists idx_applications_student   on public.applications (student_id);
create index if not exists idx_applications_status    on public.applications (status);
create index if not exists idx_applications_reference on public.applications (reference_number);

-- ---------------------------------------------------------------------------
-- SIGNATURE ASSETS (authorized transparent signatures)
-- ---------------------------------------------------------------------------
create table if not exists public.signature_assets (
  id                text primary key,
  name              text not null,
  image_url         text not null,
  original_image_url text not null,
  owner_name        text not null,
  owner_role        text not null default '',
  department        text not null default '',
  is_transparent    boolean not null default true,
  opacity           real not null default 1,
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  audit_hash        text not null default ''
);

-- ---------------------------------------------------------------------------
-- STAMP ASSETS (official seals)
-- ---------------------------------------------------------------------------
create table if not exists public.stamp_assets (
  id                 text primary key,
  name               text not null,
  image_url          text not null,
  original_image_url text not null,
  department         text not null default '',
  is_transparent     boolean not null default true,
  opacity            real not null default 1,
  active             boolean not null default true,
  created_at         timestamptz not null default now(),
  audit_hash         text not null default ''
);

-- ---------------------------------------------------------------------------
-- AUDIT LOGS (immutable compliance trail)
-- ---------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id             text primary key,
  timestamp      timestamptz not null default now(),
  actor_id       text not null default '',
  actor_name     text not null default '',
  actor_role     text not null default '',
  action         text not null,
  details        text not null default '',
  application_ref text,
  ip_address     text
);

create index if not exists idx_audit_logs_timestamp on public.audit_logs (timestamp desc);

-- ---------------------------------------------------------------------------
-- NOTIFICATIONS (per-user in-app alerts)
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id             text primary key,
  user_id        text not null,
  title          text not null,
  message        text not null default '',
  type           text not null default 'info' check (type in ('info', 'success', 'warning', 'alert')),
  read           boolean not null default false,
  created_at     timestamptz not null default now(),
  application_ref text
);

create index if not exists idx_notifications_user on public.notifications (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- DESIGNATIONS (EzScene: signing positions mapped to people)
-- ---------------------------------------------------------------------------
create table if not exists public.designations (
  id            text primary key,
  title         text not null,
  department    text not null default '',
  scope         text,
  reach         text not null default 'department' check (reach in ('department', 'university')),
  holder_id     text,
  since         text not null default '',
  affixes_seal  boolean not null default false,
  sort_order    integer not null default 0
);

-- EzScene columns (safe to re-run on an existing ApplyEase database)
alter table public.application_types add column if not exists tag text;
alter table public.applications      add column if not exists source text default 'form';
alter table public.applications      add column if not exists scan jsonb;
alter table public.signature_assets  add column if not exists owner_id text;
alter table public.audit_logs        add column if not exists prev_hash text;
alter table public.audit_logs        add column if not exists entry_hash text;

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- The app connects with the anon key and performs its own authentication
-- against `profiles`. Policies are open for the demo; tighten for production.
-- ---------------------------------------------------------------------------
alter table public.profiles           enable row level security;
alter table public.application_types  enable row level security;
alter table public.applications       enable row level security;
alter table public.signature_assets   enable row level security;
alter table public.stamp_assets       enable row level security;
alter table public.audit_logs         enable row level security;
alter table public.notifications      enable row level security;
alter table public.designations       enable row level security;

do $$
declare t text;
begin
  foreach t in array array['profiles', 'application_types', 'applications',
                           'signature_assets', 'stamp_assets', 'audit_logs', 'notifications', 'designations']
  loop
    execute format('drop policy if exists "applyease_public_access" on public.%I', t);
    execute format(
      'create policy "applyease_public_access" on public.%I for all to anon, authenticated using (true) with check (true)',
      t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- REALTIME (live cross-device sync)
-- Written to be re-runnable: adding a table that is already published raises
-- duplicate_object, which is swallowed on purpose.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.applications;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.notifications;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.audit_logs;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.profiles;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.designations;
    exception when duplicate_object then null;
    end;
  end if;
end $$;

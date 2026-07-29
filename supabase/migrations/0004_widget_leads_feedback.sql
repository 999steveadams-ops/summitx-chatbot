-- SummitX ChatBot — widget branding, lead capture, rate-limit flags, feedback.

-- ============================================================ TENANTS
alter table public.tenants
  add column if not exists logo_url           text,
  add column if not exists greeting_message   text,
  add column if not exists starter_questions  jsonb not null default '[]'::jsonb,
  add column if not exists launcher_text      text,
  add column if not exists notification_email text;

-- ============================================================ CONVERSATIONS / MESSAGES
alter table public.conversations
  add column if not exists ip      text,
  add column if not exists flagged boolean not null default false;

-- Assistant rows only: was the reply grounded in scraped website content?
alter table public.chat_messages
  add column if not exists answered_from_kb boolean;

-- ============================================================ LEADS
create table if not exists public.leads (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  name            text,
  email           text,
  phone           text,
  message         text,
  created_at      timestamptz not null default now()
);
create index if not exists leads_tenant_time_idx on public.leads (tenant_id, created_at desc);

-- ============================================================ FEEDBACK
create table if not exists public.chat_feedback (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  message_index   int not null,
  rating          text not null check (rating in ('up', 'down')),
  created_at      timestamptz not null default now(),
  unique (conversation_id, message_index)
);
create index if not exists chat_feedback_tenant_idx on public.chat_feedback (tenant_id, created_at desc);

-- ============================================================ RLS
-- Staff and that tenant's own client users may read; writes go through the
-- service role (widget visitors are anonymous), which bypasses RLS.
alter table public.leads         enable row level security;
alter table public.chat_feedback enable row level security;

drop policy if exists leads_read on public.leads;
create policy leads_read on public.leads
  for select to authenticated using (public.can_view_tenant(tenant_id));

drop policy if exists chat_feedback_read on public.chat_feedback;
create policy chat_feedback_read on public.chat_feedback
  for select to authenticated using (public.can_view_tenant(tenant_id));

-- ============================================================ STORAGE (logos)
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

-- Public bucket already serves objects publicly; this makes the intent explicit.
drop policy if exists "logos public read" on storage.objects;
create policy "logos public read" on storage.objects
  for select using (bucket_id = 'logos');

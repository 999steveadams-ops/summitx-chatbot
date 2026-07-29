-- SummitX ChatBot — chat history + client portal.
--
-- Adds: conversation logging, an `admins` table (agency staff), and
-- `tenant_members` (client logins scoped to one business).
--
-- IMPORTANT SECURITY CHANGE: migration 0001 let ANY authenticated user read and
-- edit EVERY tenant. That was fine while only agency staff had accounts, but
-- client portal logins are added here — so tenant access is now split:
--   * agency staff (in `admins`) keep full access
--   * client users (in `tenant_members`) get read-only access to their own row

-- ============================================================ STAFF / MEMBERS
create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.tenant_members (
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create index if not exists tenant_members_user_idx on public.tenant_members (user_id);

-- Bootstrap: everyone who already has an account today is agency staff.
insert into public.admins (user_id)
select id from auth.users
on conflict (user_id) do nothing;

-- ============================================================ HELPERS
-- security definer so policies can read these tables without recursive RLS.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
$$;

create or replace function public.can_view_tenant(t uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or exists (
        select 1 from public.tenant_members
        where tenant_id = t and user_id = auth.uid()
      )
$$;

-- ============================================================ CHAT HISTORY
create table if not exists public.conversations (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  visitor_id      text,
  started_at      timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role            text not null check (role in ('user', 'assistant')),
  content         text not null,
  created_at      timestamptz not null default now()
);

-- Indexes tuned for "this tenant's conversations on this date, newest first".
create index if not exists conversations_tenant_time_idx
  on public.conversations (tenant_id, last_message_at desc);
create index if not exists chat_messages_conversation_idx
  on public.chat_messages (conversation_id, created_at);

-- ============================================================ RLS
alter table public.admins         enable row level security;
alter table public.tenant_members enable row level security;
alter table public.conversations  enable row level security;
alter table public.chat_messages  enable row level security;

-- Users may see their own membership rows; admins manage everything.
drop policy if exists admins_self_read on public.admins;
create policy admins_self_read on public.admins
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists tenant_members_read on public.tenant_members;
create policy tenant_members_read on public.tenant_members
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists tenant_members_admin_write on public.tenant_members;
create policy tenant_members_admin_write on public.tenant_members
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Chat history is readable by agency staff and by that tenant's own client users.
-- Writes come from the widget via the service-role key, which bypasses RLS.
drop policy if exists conversations_read on public.conversations;
create policy conversations_read on public.conversations
  for select to authenticated using (public.can_view_tenant(tenant_id));

drop policy if exists chat_messages_read on public.chat_messages;
create policy chat_messages_read on public.chat_messages
  for select to authenticated using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and public.can_view_tenant(c.tenant_id)
    )
  );

-- ============================================================ TIGHTEN tenants
drop policy if exists tenants_staff_all on public.tenants;

drop policy if exists tenants_admin_all on public.tenants;
create policy tenants_admin_all on public.tenants
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Client users can read (not modify) the business they belong to.
drop policy if exists tenants_member_read on public.tenants;
create policy tenants_member_read on public.tenants
  for select to authenticated using (
    exists (
      select 1 from public.tenant_members m
      where m.tenant_id = id and m.user_id = auth.uid()
    )
  );

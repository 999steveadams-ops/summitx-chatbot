-- SummitX ChatBot — tenants (client businesses) schema + Row Level Security.
-- Each row is one client business whose branded chat widget is embedded on their site.

create extension if not exists pgcrypto;

-- ============================================================ TABLE
create table if not exists public.tenants (
  id            uuid primary key default gen_random_uuid(),
  business_name text not null,
  system_prompt text not null default
    'You are a friendly, professional assistant for this business. '
    'Answer visitor questions clearly and concisely, and stay on topic. '
    'If you do not know something, say so and offer to connect them with the team.',
  brand_color   text not null default '#4f46e5',
  owner_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Keep updated_at fresh on every write.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists tenants_set_updated_at on public.tenants;
create trigger tenants_set_updated_at
  before update on public.tenants
  for each row execute function public.set_updated_at();

-- ============================================================ ROW LEVEL SECURITY
-- Only authenticated agency staff may read/write tenants. The public chat widget
-- never touches this table directly — the server routes use the service-role key,
-- so `system_prompt` is never exposed to `anon` or to the browser.
alter table public.tenants enable row level security;

drop policy if exists tenants_staff_all on public.tenants;
create policy tenants_staff_all on public.tenants
  for all
  to authenticated
  using (true)
  with check (true);

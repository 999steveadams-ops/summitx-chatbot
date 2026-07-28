# SummitX ChatBot — Setup

A multi-tenant AI chatbot micro-SaaS. Add client businesses in the admin dashboard, give
each a private system prompt + brand color, and drop a one-line `<script>` on their site.

## Prerequisites
- Node 20+ (tested on Node 24)
- A free [Supabase](https://supabase.com) project
- A free [Google AI Studio](https://aistudio.google.com/app/apikey) (Gemini) API key

## 1. Install
```bash
npm install
```

## 2. Environment variables
Copy the example and fill in real values:
```bash
cp .env.example .env.local
```

| Variable | Where to find it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API (anon/public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API (service_role — **keep secret**) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google AI Studio → API keys |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` for dev; your domain in prod |

> The service role key is server-only and is what keeps each tenant's `system_prompt`
> private — it never reaches the browser.

## 3. Create the database schema
In the Supabase dashboard → **SQL Editor**, paste and run:

```sql
create extension if not exists pgcrypto;

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

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists tenants_set_updated_at on public.tenants;
create trigger tenants_set_updated_at
  before update on public.tenants
  for each row execute function public.set_updated_at();

alter table public.tenants enable row level security;

drop policy if exists tenants_staff_all on public.tenants;
create policy tenants_staff_all on public.tenants
  for all to authenticated using (true) with check (true);
```

(The same SQL lives in `supabase/migrations/0001_tenants.sql`.)

## 4. Create an admin user
Supabase → **Authentication → Users → Add user** (email + password, mark it confirmed).
That's the account you'll sign in with at `/admin/login`.

## 5. Run
```bash
npm run dev
```

- Landing page: http://localhost:3000
- Admin: http://localhost:3000/admin  → redirects to `/admin/login`
- After adding a client, use its **Preview ↗** link or copy the embed snippet into
  `test-embed.html` (in the repo root) and open that file to see the floating widget.

## How the pieces fit
- **`/admin`** — dashboard (Supabase-auth protected by `proxy.ts`). CRUD tenants + snippet.
- **`/widget/[tenantId]`** — the branded chat UI (renders inside the embed iframe).
- **`/api/chat`** — streams Gemini replies, loading the tenant's private prompt server-side.
- **`/embed.js?id=…`** — the loader script clients paste on their own site.

# SummitX ChatBot

Multi-tenant AI chatbot micro-SaaS. Agency staff add client businesses ("tenants"), each
with a private system prompt and brand color, and hand each client a single `<script>` tag
that drops a branded AI chat widget onto their website — powered by Google Gemini via the
Vercel AI SDK.

## Stack
- **Next.js 16** (App Router, Server Components, `proxy.ts`) · React 19
- **Tailwind CSS v4**
- **Supabase** — Auth + Postgres (Row Level Security)
- **Vercel AI SDK v7** + `@ai-sdk/google` → `gemini-2.0-flash`

## Architecture
```
app/
  page.tsx                     Landing page
  admin/
    login/page.tsx             Supabase email+password sign in
    page.tsx                   Dashboard: list + add clients
    actions.ts                 Server Actions (create/update/delete/signOut)
    AddClientForm.tsx          Add-client form (client component)
    TenantCard.tsx             Edit + embed snippet + delete (client component)
  widget/[tenantId]/
    page.tsx                   Public widget page (reads brand_color/name only)
    ChatWidget.tsx             useChat streaming UI
  api/chat/route.ts            Streams Gemini, loads private system_prompt server-side
  embed.js/route.ts            The loader script served at /embed.js
lib/supabase/{client,server,admin}.ts   3 Supabase client factories
proxy.ts                       Auth guard for /admin (Next 16 renamed middleware → proxy)
supabase/migrations/           tenants table + RLS
```

## Security model
- `tenants` RLS grants access to `authenticated` only.
- Each tenant's **`system_prompt` never reaches the browser**: the public widget page and
  `/api/chat` read tenant data through the service-role client, and the widget page selects
  only `business_name` + `brand_color`. The prompt is used solely as the model's `system`
  instruction inside `/api/chat`.

## Getting started
See **[SETUP.md](./SETUP.md)** for env vars, the schema SQL, and run steps.

```bash
npm install
cp .env.example .env.local   # then fill in real keys
npm run dev
```

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# SummitX ChatBot — Engineering Guide

Multi-tenant AI chatbot micro-SaaS. Agency staff add client businesses ("tenants"), each
with a `business_name`, private `system_prompt`, and `brand_color`. Every tenant gets a
one-line `<script>` embed that drops a branded chat widget onto their own website, powered
by Google Gemini through the Vercel AI SDK.

## Stack (all pinned & verified against installed packages)
- **Next.js 16.2** (App Router) · **React 19.2**
- **Tailwind CSS v4** (CSS-first config — no `tailwind.config.js`)
- **Supabase** (`@supabase/ssr` 0.12, `@supabase/supabase-js` 2.111) for Auth + Postgres
- **Vercel AI SDK v7** (`ai` 7.x, `@ai-sdk/react` 4.x) + **`@ai-sdk/google`** 4.x → `gemini-2.0-flash`

## Next.js 16 rules — do not violate
- **`params` and `searchParams` are Promises. Await them.**
  `export default async function Page({ params }: { params: Promise<{ tenantId: string }> }) { const { tenantId } = await params }`
- **`cookies()` is async. Await it.** `const cookieStore = await cookies()`.
- **Middleware is renamed to Proxy.** The root file is **`proxy.ts`** (NOT `middleware.ts`) and
  exports a `proxy` function. Same `NextRequest`/`NextResponse` semantics.
- **Server Components by default.** Add `"use client"` only on interactive leaves
  (login form, add/edit forms, the chat widget). Data fetching stays on the server.
- Route Handlers use the Web `Request`/`Response` API in `app/**/route.ts`.

## Supabase client split (security boundary — do not blur it)
Three factories in `lib/supabase/`:
- **`client.ts`** — `createBrowserClient` (anon key). Browser only; used by the login form.
- **`server.ts`** — `createServerClient` (anon key + awaited `cookies()`). Server Components,
  Server Actions. Runs **as the signed-in user** → subject to RLS.
- **`admin.ts`** — service-role key. **Server-only.** The only path allowed to read
  `system_prompt`. NEVER import this into a client component or send its data to the browser.

### The `system_prompt` must never reach the browser
- The public widget page and `/api/chat` read tenant data via the **service role**, and the
  widget page selects **only** `business_name, brand_color`.
- `/api/chat` reads `system_prompt` server-side and passes it to `streamText` as `system`; it
  is never included in any response body.
- RLS on `tenants` grants access to `authenticated` only. `anon` has no table access — the
  public runtime paths deliberately go through the service role instead.

## AI SDK v7 shape (changed from v4 tutorials)
- Server: `streamText({ model: google('gemini-2.0-flash'), system, messages: convertToModelMessages(messages) })`
  then `return result.toUIMessageStreamResponse()`.
- Client: `useChat` (from `@ai-sdk/react`) takes a `transport: new DefaultChatTransport({ api, body })`.
  It does **not** manage input state — keep input in `useState` and call `sendMessage({ text })`.
  Render `message.parts` (filter `part.type === 'text'`).

## Env vars (`.env.local`)
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`GOOGLE_GENERATIVE_AI_API_KEY`, `NEXT_PUBLIC_APP_URL`. See `.env.example` and `SETUP.md`.

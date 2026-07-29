"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import type { Tenant } from "@/lib/types";
import { createClientLogin, deleteTenant, updateTenant, uploadLogo } from "./actions";

/**
 * Crawl the client's website so the assistant answers from real content
 * instead of guessing.
 */
function KnowledgeSection({
  tenantId,
  websiteUrl,
  lastScannedAt,
}: {
  tenantId: string;
  websiteUrl: string | null;
  lastScannedAt: string | null;
}) {
  const [url, setUrl] = useState(websiteUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function scan() {
    if (!url.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, websiteUrl: url.trim() }),
      });
      const data = await res.json();
      setMsg(
        res.ok
          ? { ok: true, text: `Learned ${data.chunks} passages from ${data.pages} pages.` }
          : { ok: false, text: data.error ?? "Scan failed." },
      );
    } catch {
      setMsg({ ok: false, text: "Scan failed — the site may be slow or unreachable." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 border-t border-zinc-100 pt-4">
      <p className="text-sm font-semibold text-zinc-700">Website knowledge</p>
      <p className="mb-2 text-xs text-zinc-400">
        Scan the client&apos;s site so the bot answers from their real content.
        {lastScannedAt
          ? ` Last scanned ${new Date(lastScannedAt).toLocaleString("en-US")}.`
          : " Not scanned yet."}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://theirwebsite.com"
          className="min-w-[220px] flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
        />
        <button
          onClick={scan}
          disabled={busy || !url.trim()}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
        >
          {busy ? "Scanning…" : "Scan website"}
        </button>
      </div>

      {busy && (
        <p className="mt-2 text-xs text-zinc-500">
          Reading pages and building the index — this can take a minute.
        </p>
      )}
      {msg && (
        <p
          className={`mt-2 rounded-lg px-3 py-2 text-xs ${
            msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
          }`}
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}

/** Create a portal login so this client can read their own chat history. */
function ClientLoginSection({
  tenantId,
  appUrl,
}: {
  tenantId: string;
  appUrl: string;
}) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(formData: FormData) {
    setPending(true);
    setResult(await createClientLogin(formData));
    setPending(false);
  }

  return (
    <div className="mt-6 border-t border-zinc-100 pt-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-zinc-700">Client portal access</p>
          <p className="text-xs text-zinc-400">
            Let this client sign in at {appUrl}/portal to read their chat history.
          </p>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:border-zinc-400"
        >
          {open ? "Cancel" : "Add login"}
        </button>
      </div>

      {open && (
        <form action={submit} className="mt-3 flex flex-wrap items-end gap-2">
          <input type="hidden" name="tenant_id" value={tenantId} />
          <div className="flex-1 min-w-[180px]">
            <label className="mb-1 block text-xs font-medium text-zinc-600">
              Client email
            </label>
            <input
              name="email"
              type="email"
              required
              placeholder="owner@theirbusiness.com"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="mb-1 block text-xs font-medium text-zinc-600">
              Temporary password
            </label>
            <input
              name="password"
              type="text"
              required
              minLength={8}
              placeholder="min 8 characters"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
          >
            {pending ? "Creating…" : "Create"}
          </button>
        </form>
      )}

      {result && (
        <p
          className={`mt-2 rounded-lg px-3 py-2 text-xs ${
            result.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
          }`}
        >
          {result.message}
        </p>
      )}
    </div>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
    >
      {pending ? "Saving…" : "Save changes"}
    </button>
  );
}

/** PNG logo upload for the widget header + launcher. */
function LogoUploader({ tenantId, logoUrl }: { tenantId: string; logoUrl: string | null }) {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(logoUrl);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "image/png") {
      setMsg({ ok: false, text: "Logo must be a PNG." });
      return;
    }
    setBusy(true);
    setMsg(null);
    const fd = new FormData();
    fd.set("tenant_id", tenantId);
    fd.set("logo", file);
    const res = await uploadLogo(fd);
    setMsg({ ok: res.ok, text: res.message });
    if (res.ok) setPreview(URL.createObjectURL(file));
    setBusy(false);
  }

  return (
    <div className="mt-6 border-t border-zinc-100 pt-4">
      <p className="text-sm font-semibold text-zinc-700">Logo (PNG)</p>
      <p className="mb-2 text-xs text-zinc-400">
        Shown in the widget header and on the launcher button.
      </p>
      <div className="flex items-center gap-3">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Logo"
            className="h-12 w-12 rounded-full border border-zinc-200 object-cover"
          />
        ) : (
          <div className="grid h-12 w-12 place-items-center rounded-full bg-zinc-100 text-xs text-zinc-400">
            none
          </div>
        )}
        <label className="cursor-pointer rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:border-zinc-400">
          {busy ? "Uploading…" : "Upload PNG"}
          <input
            type="file"
            accept="image/png"
            className="hidden"
            disabled={busy}
            onChange={onFile}
          />
        </label>
      </div>
      {msg && (
        <p className={`mt-2 text-xs ${msg.ok ? "text-green-600" : "text-red-600"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}

export default function TenantCard({
  tenant,
  appUrl,
}: {
  tenant: Tenant;
  appUrl: string;
}) {
  const [color, setColor] = useState(tenant.brand_color);
  const [copied, setCopied] = useState(false);

  const snippet = `<script src="${appUrl}/embed.js?id=${tenant.id}" async></script>`;
  const previewUrl = `${appUrl}/widget/${tenant.id}`;

  async function copySnippet() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="h-8 w-8 rounded-full ring-1 ring-inset ring-black/10"
            style={{ backgroundColor: color }}
          />
          <div>
            <h3 className="font-semibold">{tenant.business_name}</h3>
            <p className="font-mono text-xs text-zinc-400">{tenant.id}</p>
          </div>
        </div>
        <a
          href={previewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:border-zinc-400"
        >
          Preview ↗
        </a>
      </div>

      {/* Edit form */}
      <form action={updateTenant} className="space-y-4">
        <input type="hidden" name="id" value={tenant.id} />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              Business name
            </label>
            <input
              name="business_name"
              defaultValue={tenant.business_name}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              Brand color
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                name="brand_color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-10 w-14 cursor-pointer rounded border border-zinc-300 bg-white"
                aria-label="Brand color"
              />
              <span className="font-mono text-sm text-zinc-500">{color}</span>
            </div>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">
            System prompt
          </label>
          <textarea
            name="system_prompt"
            rows={4}
            defaultValue={tenant.system_prompt}
            className="w-full resize-y rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-indigo-500"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              Welcome message
            </label>
            <input
              name="greeting_message"
              defaultValue={tenant.greeting_message ?? ""}
              placeholder="👋 Hi! How can I help you today?"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              Launcher bubble text
            </label>
            <input
              name="launcher_text"
              defaultValue={tenant.launcher_text ?? ""}
              placeholder="Have any questions? Ask away!"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">
            Starter questions{" "}
            <span className="font-normal text-zinc-400">(one per line, up to 6)</span>
          </label>
          <textarea
            name="starter_questions"
            rows={3}
            defaultValue={(tenant.starter_questions ?? []).join("\n")}
            placeholder={"What are your prices?\nDo you do weddings?\nWhat areas do you serve?"}
            className="w-full resize-y rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">
            Client notification email{" "}
            <span className="font-normal text-zinc-400">(gets lead alerts)</span>
          </label>
          <input
            name="notification_email"
            type="email"
            defaultValue={tenant.notification_email ?? ""}
            placeholder="owner@theirbusiness.com"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center justify-between">
          <SaveButton />
        </div>
      </form>

      {/* Logo upload */}
      <LogoUploader tenantId={tenant.id} logoUrl={tenant.logo_url ?? null} />

      {/* Embed snippet */}
      <div className="mt-6 border-t border-zinc-100 pt-4">
        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm font-semibold text-zinc-700">Embed snippet</label>
          <button
            onClick={copySnippet}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-500"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <pre className="overflow-x-auto rounded-lg bg-zinc-900 p-3 text-xs text-zinc-100">
          <code>{snippet}</code>
        </pre>
        <p className="mt-2 text-xs text-zinc-400">
          Paste this just before <code>&lt;/body&gt;</code> on the client&apos;s website.
        </p>
      </div>

      {/* Website knowledge base */}
      <KnowledgeSection
        tenantId={tenant.id}
        websiteUrl={tenant.website_url ?? null}
        lastScannedAt={tenant.last_scanned_at ?? null}
      />

      {/* Client portal access */}
      <ClientLoginSection tenantId={tenant.id} appUrl={appUrl} />

      {/* Delete */}
      <div className="mt-4 border-t border-zinc-100 pt-4">
        <form
          action={deleteTenant}
          onSubmit={(e) => {
            if (!confirm(`Delete ${tenant.business_name}? This cannot be undone.`)) {
              e.preventDefault();
            }
          }}
        >
          <input type="hidden" name="id" value={tenant.id} />
          <button className="text-sm font-medium text-red-600 transition hover:text-red-500">
            Delete client
          </button>
        </form>
      </div>
    </div>
  );
}

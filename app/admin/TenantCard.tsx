"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import type { Tenant } from "@/lib/types";
import { createClientLogin, deleteTenant, updateTenant } from "./actions";

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

        <div className="flex items-center justify-between">
          <SaveButton />
        </div>
      </form>

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

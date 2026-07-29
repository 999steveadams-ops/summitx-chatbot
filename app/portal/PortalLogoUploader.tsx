"use client";

import { useState } from "react";
import { uploadPortalLogo } from "./actions";

export default function PortalLogoUploader({
  tenantId,
  logoUrl,
}: {
  tenantId: string;
  logoUrl: string | null;
}) {
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
    const res = await uploadPortalLogo(fd);
    setMsg({ ok: res.ok, text: res.message });
    if (res.ok) setPreview(URL.createObjectURL(file));
    setBusy(false);
  }

  return (
    <div>
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

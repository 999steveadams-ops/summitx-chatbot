import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_BYTES = 1_000_000; // ~1 MB
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47]; // \x89PNG

/**
 * Validate a PNG upload and store it in the public `logos` bucket, then set
 * `tenants.logo_url`. Returns the public URL (cache-busted) or an error string.
 *
 * PNG only, by both MIME type and magic bytes. Uses the service role, so callers
 * MUST authorize (staff, or a verified member of the tenant) before calling.
 */
export async function storeLogo(
  tenantId: string,
  file: File,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!file || file.size === 0) return { ok: false, error: "No file provided." };
  if (file.size > MAX_BYTES) return { ok: false, error: "Logo must be under 1 MB." };
  if (file.type && file.type !== "image/png") {
    return { ok: false, error: "Logo must be a PNG image." };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const isPng = PNG_MAGIC.every((b, i) => bytes[i] === b);
  if (!isPng) return { ok: false, error: "That file isn't a valid PNG." };

  const admin = createAdminClient();
  const path = `${tenantId}.png`;

  const { error: upErr } = await admin.storage.from("logos").upload(path, bytes, {
    contentType: "image/png",
    upsert: true,
  });
  if (upErr) return { ok: false, error: upErr.message };

  const { data: pub } = admin.storage.from("logos").getPublicUrl(path);
  // Cache-bust so the widget/launcher pick up a replaced logo immediately.
  const url = `${pub.publicUrl}?v=${Date.now()}`;

  const { error: dbErr } = await admin
    .from("tenants")
    .update({ logo_url: url })
    .eq("id", tenantId);
  if (dbErr) return { ok: false, error: dbErr.message };

  return { ok: true, url };
}

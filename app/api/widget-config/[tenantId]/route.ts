import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_LAUNCHER_TEXT } from "@/lib/types";

// Public branding config for the embed loader (host page). Returns ONLY safe,
// non-secret fields — never system_prompt.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const { tenantId } = await params;

  const admin = createAdminClient();
  const { data } = await admin
    .from("tenants")
    .select("business_name, brand_color, logo_url, launcher_text")
    .eq("id", tenantId)
    .single();

  if (!data) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  return Response.json(
    {
      businessName: data.business_name,
      brandColor: data.brand_color,
      logoUrl: data.logo_url ?? null,
      launcherText: data.launcher_text || DEFAULT_LAUNCHER_TEXT,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=300",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { storeLogo } from "@/lib/logo";

export async function signOutPortal() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/portal/login");
}

/**
 * A client uploads their own logo. Clients are read-only on `tenants` (RLS), so
 * we verify membership here and then write via the service role.
 */
export async function uploadPortalLogo(
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not signed in." };

  const tenantId = String(formData.get("tenant_id") ?? "");
  const file = formData.get("logo");
  if (!tenantId || !(file instanceof File)) {
    return { ok: false, message: "Choose a PNG file first." };
  }

  const admin = createAdminClient();

  // Authorize: this user must be a member of the tenant (or agency staff).
  const [{ data: member }, { data: staff }] = await Promise.all([
    admin
      .from("tenant_members")
      .select("user_id")
      .eq("tenant_id", tenantId)
      .eq("user_id", user.id)
      .maybeSingle(),
    admin.from("admins").select("user_id").eq("user_id", user.id).maybeSingle(),
  ]);
  if (!member && !staff) return { ok: false, message: "Not allowed." };

  const res = await storeLogo(tenantId, file);
  if (!res.ok) return { ok: false, message: res.error };

  revalidatePath("/portal");
  return { ok: true, message: "Logo updated." };
}

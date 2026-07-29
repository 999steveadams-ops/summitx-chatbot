"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { storeLogo } from "@/lib/logo";

const HEX = /^#[0-9a-fA-F]{6}$/;

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  return supabase;
}

export async function createTenant(formData: FormData) {
  const supabase = await requireUser();

  const business_name = String(formData.get("business_name") ?? "").trim();
  const system_prompt = String(formData.get("system_prompt") ?? "").trim();
  const brand_color = String(formData.get("brand_color") ?? "").trim();

  if (!business_name) return;

  // Inserts run as the signed-in user; owner_id defaults to auth.uid() in SQL.
  await supabase.from("tenants").insert({
    business_name,
    ...(system_prompt ? { system_prompt } : {}),
    ...(HEX.test(brand_color) ? { brand_color } : {}),
  });

  revalidatePath("/admin");
}

export async function updateTenant(formData: FormData) {
  const supabase = await requireUser();

  const id = String(formData.get("id") ?? "");
  const business_name = String(formData.get("business_name") ?? "").trim();
  const system_prompt = String(formData.get("system_prompt") ?? "").trim();
  const brand_color = String(formData.get("brand_color") ?? "").trim();
  const greeting_message = String(formData.get("greeting_message") ?? "").trim();
  const launcher_text = String(formData.get("launcher_text") ?? "").trim();
  const notification_email = String(formData.get("notification_email") ?? "").trim();
  // Starter questions arrive one-per-line in a textarea.
  const starter_questions = String(formData.get("starter_questions") ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6);

  if (!id) return;

  await supabase
    .from("tenants")
    .update({
      ...(business_name ? { business_name } : {}),
      system_prompt,
      ...(HEX.test(brand_color) ? { brand_color } : {}),
      greeting_message: greeting_message || null,
      launcher_text: launcher_text || null,
      notification_email: notification_email || null,
      starter_questions,
    })
    .eq("id", id);

  revalidatePath("/admin");
}

export async function uploadLogo(
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
  const { data: isStaff } = await admin
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!isStaff) return { ok: false, message: "Staff only." };

  const res = await storeLogo(tenantId, file);
  if (!res.ok) return { ok: false, message: res.error };

  revalidatePath("/admin");
  return { ok: true, message: "Logo updated." };
}

export async function deleteTenant(formData: FormData) {
  const supabase = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase.from("tenants").delete().eq("id", id);
  revalidatePath("/admin");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

/**
 * Give a client a portal login for one tenant.
 *
 * Creates (or reuses) a Supabase auth user via the service role, then links it
 * to the tenant through `tenant_members`. RLS then limits that user to this
 * business's conversations only.
 */
export async function createClientLogin(
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not signed in." };

  const tenantId = String(formData.get("tenant_id") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!tenantId || !email || password.length < 8) {
    return { ok: false, message: "Email and a password of 8+ characters are required." };
  }

  const admin = createAdminClient();

  // Only agency staff may hand out logins.
  const { data: isStaff } = await admin
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!isStaff) return { ok: false, message: "Only agency staff can add client logins." };

  let userId: string | null = null;

  const { data: created, error: createErr } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

  if (created?.user) {
    userId = created.user.id;
  } else if (createErr) {
    // Most likely the address already has an account — find and reuse it.
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const found = list?.users.find((u) => u.email?.toLowerCase() === email);
    if (!found) return { ok: false, message: createErr.message };
    userId = found.id;
  }

  if (!userId) return { ok: false, message: "Could not create that login." };

  const { error: linkErr } = await admin
    .from("tenant_members")
    .upsert({ tenant_id: tenantId, user_id: userId });

  if (linkErr) return { ok: false, message: linkErr.message };

  revalidatePath("/admin");
  return { ok: true, message: `${email} can now sign in at /portal.` };
}

/** Revoke a client's access to a tenant's portal. */
export async function removeClientLogin(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const tenantId = String(formData.get("tenant_id") ?? "");
  const userId = String(formData.get("user_id") ?? "");
  if (!tenantId || !userId) return;

  const admin = createAdminClient();
  const { data: isStaff } = await admin
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!isStaff) return;

  await admin
    .from("tenant_members")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("user_id", userId);

  revalidatePath("/admin");
}

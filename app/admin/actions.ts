"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

  if (!id) return;

  await supabase
    .from("tenants")
    .update({
      ...(business_name ? { business_name } : {}),
      system_prompt,
      ...(HEX.test(brand_color) ? { brand_color } : {}),
    })
    .eq("id", id);

  revalidatePath("/admin");
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

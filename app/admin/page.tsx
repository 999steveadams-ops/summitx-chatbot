import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Tenant } from "@/lib/types";
import { signOut } from "./actions";
import AddClientForm from "./AddClientForm";
import TenantCard from "./TenantCard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Defense in depth — proxy.ts already guards this route.
  if (!user) redirect("/admin/login");

  // Staff only. A client (tenant member) who signs in should go to their portal,
  // not the agency dashboard.
  const { data: staff } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!staff) redirect("/portal");

  const { data: tenants } = await supabase
    .from("tenants")
    .select("*")
    .order("created_at", { ascending: false });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const list = (tenants ?? []) as Tenant[];

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 text-zinc-900">
      {/* Top bar */}
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 font-semibold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
              SX
            </span>
            SummitX ChatBot
          </div>
          <div className="flex items-center gap-4">
            <a
              href="/admin/analytics"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              Analytics &amp; leads
            </a>
            <span className="hidden text-sm text-zinc-500 sm:inline">{user.email}</span>
            <form action={signOut}>
              <button className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm font-medium text-zinc-700 transition hover:border-zinc-400">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Client chatbots</h1>
          <p className="text-sm text-zinc-500">
            Add a client, tune their prompt and brand, then hand them the embed snippet.
          </p>
        </div>

        <AddClientForm />

        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            {list.length} client{list.length === 1 ? "" : "s"}
          </h2>

          {list.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500">
              No clients yet. Add your first one above.
            </div>
          ) : (
            <div className="space-y-4">
              {list.map((t) => (
                <TenantCard key={t.id} tenant={t} appUrl={appUrl} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

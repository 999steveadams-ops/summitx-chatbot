import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const { data: staff } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!staff) redirect("/portal");

  const since = new Date(Date.now() - 30 * 864e5).toISOString();

  // RLS: staff see all tenants' data.
  const [
    { count: convCount },
    { count: msgCount },
    { count: upCount },
    { count: downCount },
    { data: unanswered },
    { data: recentLeads },
  ] = await Promise.all([
    supabase.from("conversations").select("id", { count: "exact", head: true }).gte("started_at", since),
    supabase.from("chat_messages").select("id", { count: "exact", head: true }).eq("role", "user").gte("created_at", since),
    supabase.from("chat_feedback").select("id", { count: "exact", head: true }).eq("rating", "up"),
    supabase.from("chat_feedback").select("id", { count: "exact", head: true }).eq("rating", "down"),
    supabase
      .from("chat_messages")
      .select("content, created_at, conversations!inner(tenant_id, tenants(business_name))")
      .eq("role", "user")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("leads")
      .select("id, name, email, phone, created_at, tenants(business_name)")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  // "Unanswered" questions: user messages immediately followed by a not-grounded
  // reply are hard to join cheaply, so we surface the most recent questions and
  // let staff scan them. (A dedicated flag exists on assistant rows for future use.)
  type QRow = {
    content: string;
    created_at: string;
    conversations: { tenants: { business_name: string }[] | null }[] | null;
  };
  const recentQuestions = ((unanswered ?? []) as unknown as QRow[]).slice(0, 15);
  const bizOf = (q: QRow) => q.conversations?.[0]?.tenants?.[0]?.business_name ?? "";

  type LRow = {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    created_at: string;
    tenants: { business_name: string }[] | null;
  };
  const leads = (recentLeads ?? []) as unknown as LRow[];

  const stat = (label: string, value: number | null) => (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-1 text-3xl font-bold">{value ?? 0}</p>
    </div>
  );

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/admin" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
            ← Dashboard
          </Link>
          <span className="text-sm text-zinc-500">Analytics &amp; leads</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        <h1 className="mb-1 text-2xl font-bold">Analytics</h1>
        <p className="mb-6 text-sm text-zinc-500">Across all clients · last 30 days.</p>

        <div className="grid gap-4 sm:grid-cols-4">
          {stat("Conversations", convCount)}
          {stat("Visitor messages", msgCount)}
          {stat("👍 Helpful", upCount)}
          {stat("👎 Not helpful", downCount)}
        </div>

        <h2 className="mt-10 mb-3 text-lg font-semibold">Recent leads</h2>
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          {leads.length === 0 ? (
            <p className="p-6 text-center text-sm text-zinc-500">No leads yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-2">Business</th>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Contact</th>
                  <th className="px-4 py-2">When</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id} className="border-t border-zinc-100">
                    <td className="px-4 py-2">{l.tenants?.[0]?.business_name ?? "—"}</td>
                    <td className="px-4 py-2">{l.name || "—"}</td>
                    <td className="px-4 py-2">{l.email || l.phone || "—"}</td>
                    <td className="px-4 py-2 text-zinc-500">
                      {new Date(l.created_at).toLocaleString("en-US")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <h2 className="mt-10 mb-3 text-lg font-semibold">Recent questions</h2>
        <div className="space-y-2">
          {recentQuestions.length === 0 ? (
            <p className="text-sm text-zinc-500">No questions yet.</p>
          ) : (
            recentQuestions.map((q, i) => (
              <div key={i} className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm">
                <span className="text-zinc-800">{q.content}</span>
                <span className="ml-2 text-xs text-zinc-400">· {bizOf(q)}</span>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}

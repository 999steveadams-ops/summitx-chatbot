import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOutPortal } from "./actions";
import DateFilter from "./DateFilter";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  tenant_id: string;
  visitor_id: string | null;
  started_at: string;
  last_message_at: string;
  tenants: { business_name: string; brand_color: string } | null;
};

/** "07/28/2026" -> [startISO, endISO) covering that local calendar day. */
function dayRange(mdy: string): { from: string; to: string } | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(mdy.trim());
  if (!m) return null;
  const [, mm, dd, yyyy] = m;
  const start = new Date(Number(yyyy), Number(mm) - 1, Number(dd), 0, 0, 0, 0);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { from: start.toISOString(), to: end.toISOString() };
}

export default async function PortalPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  // Next.js 16: searchParams is a Promise.
  const { date } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/portal/login");

  // RLS restricts these rows to the tenants this user belongs to (or all, for staff).
  let query = supabase
    .from("conversations")
    .select("id, tenant_id, visitor_id, started_at, last_message_at, tenants(business_name, brand_color)")
    .order("last_message_at", { ascending: false })
    .limit(200);

  const range = date ? dayRange(date) : null;
  if (range) {
    query = query
      .gte("last_message_at", range.from)
      .lt("last_message_at", range.to);
  }

  const { data, error } = await query;
  const rows = (data ?? []) as unknown as Row[];
  const businessName = rows[0]?.tenants?.business_name ?? "Your business";

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 font-semibold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
              SX
            </span>
            Client Portal
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-zinc-500 sm:inline">{user.email}</span>
            <form action={signOutPortal}>
              <button className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm font-medium text-zinc-700 transition hover:border-zinc-400">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">
        <h1 className="text-2xl font-bold">Chat history</h1>
        <p className="mb-6 text-sm text-zinc-500">
          Every conversation visitors had with {businessName}&apos;s assistant.
        </p>

        <DateFilter initial={date ?? ""} />

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            Couldn&apos;t load conversations: {error.message}
          </p>
        )}

        <div className="mt-6 space-y-3">
          {rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500">
              {date
                ? `No conversations on ${date}.`
                : "No conversations yet. Once visitors chat with your widget, they'll appear here."}
            </div>
          ) : (
            rows.map((c) => (
              <Link
                key={c.id}
                href={`/portal/${c.id}`}
                className="block rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-indigo-300"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium">
                      {new Date(c.last_message_at).toLocaleString("en-US", {
                        month: "2-digit",
                        day: "2-digit",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-400">
                      Visitor {c.visitor_id ? c.visitor_id.slice(0, 8) : "unknown"}
                    </p>
                  </div>
                  <span className="text-sm font-medium text-indigo-600">View →</span>
                </div>
              </Link>
            ))
          )}
        </div>
      </main>
    </div>
  );
}

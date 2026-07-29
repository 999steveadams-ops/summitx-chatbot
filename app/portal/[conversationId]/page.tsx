import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export default async function TranscriptPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  // Next.js 16: params is a Promise.
  const { conversationId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/portal/login");

  // RLS makes this return nothing unless the viewer may see this tenant.
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, started_at, last_message_at, visitor_id, tenants(business_name, brand_color)")
    .eq("id", conversationId)
    .maybeSingle();

  if (!conversation) notFound();

  const { data } = await supabase
    .from("chat_messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  const messages = (data ?? []) as Msg[];
  const tenant = (conversation as unknown as {
    tenants: { business_name: string; brand_color: string } | null;
  }).tenants;
  const brand = tenant?.brand_color ?? "#4f46e5";

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-4">
          <Link
            href="/portal"
            className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
          >
            ← All conversations
          </Link>
          <span className="text-sm text-zinc-500">
            {new Date(conversation.started_at).toLocaleString("en-US", {
              month: "2-digit",
              day: "2-digit",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <h1 className="mb-1 text-xl font-bold">Conversation transcript</h1>
        <p className="mb-6 text-sm text-zinc-500">
          {messages.length} message{messages.length === 1 ? "" : "s"}
          {conversation.visitor_id
            ? ` · visitor ${conversation.visitor_id.slice(0, 8)}`
            : ""}
        </p>

        <div className="space-y-3">
          {messages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500">
              This conversation has no messages.
            </div>
          ) : (
            messages.map((m) => {
              const isUser = m.role === "user";
              return (
                <div
                  key={m.id}
                  className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div className="max-w-[80%]">
                    <div
                      className={`whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
                        isUser
                          ? "rounded-br-sm text-white"
                          : "rounded-bl-sm border border-zinc-200 bg-white text-zinc-800"
                      }`}
                      style={isUser ? { backgroundColor: brand } : undefined}
                    >
                      {m.content}
                    </div>
                    <p
                      className={`mt-1 text-[11px] text-zinc-400 ${
                        isUser ? "text-right" : "text-left"
                      }`}
                    >
                      {isUser ? "Visitor" : "Assistant"} ·{" "}
                      {new Date(m.created_at).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}

import { google } from "@ai-sdk/google";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createAdminClient } from "@/lib/supabase/admin";
import { embedTexts } from "@/lib/crawler";

// Allow streamed responses up to 30 seconds.
export const maxDuration = 30;

type ChatBody = {
  messages: UIMessage[];
  tenantId?: string;
  conversationId?: string;
  visitorId?: string;
};

/** Flatten a UIMessage's text parts into a single string. */
function textOf(message: UIMessage): string {
  return message.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { text: string }).text)
    .join("");
}

export async function POST(req: Request) {
  const { messages, tenantId, conversationId, visitorId }: ChatBody =
    await req.json();

  if (!tenantId) {
    return new Response("Missing tenantId", { status: 400 });
  }

  // Read the tenant's PRIVATE system prompt server-side, via the service role.
  // This value is used only as the model's `system` instruction and is never
  // returned to the browser.
  const admin = createAdminClient();
  const { data: tenant, error } = await admin
    .from("tenants")
    .select("system_prompt")
    .eq("id", tenantId)
    .single();

  if (error || !tenant) {
    return new Response("Unknown tenant", { status: 404 });
  }

  // ---- Conversation logging (service role; widget visitors are anonymous) ----
  // Reuse the conversation the widget sent, but only if it really belongs to
  // this tenant — otherwise a caller could append to someone else's transcript.
  // The widget generates the id, so the whole thread keeps one row. We adopt it
  // only when it is unused or already belongs to this tenant.
  let convId: string | null = null;
  const isUuid =
    !!conversationId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      conversationId,
    );

  if (isUuid) {
    const { data: existing } = await admin
      .from("conversations")
      .select("id, tenant_id")
      .eq("id", conversationId)
      .maybeSingle();

    if (existing) {
      // Only continue it if it is this tenant's thread.
      if (existing.tenant_id === tenantId) convId = existing.id;
    } else {
      const { data: created } = await admin
        .from("conversations")
        .insert({
          id: conversationId,
          tenant_id: tenantId,
          visitor_id: visitorId ?? null,
        })
        .select("id")
        .single();
      convId = created?.id ?? null;
    }
  }

  if (!convId) {
    const { data: created } = await admin
      .from("conversations")
      .insert({ tenant_id: tenantId, visitor_id: visitorId ?? null })
      .select("id")
      .single();
    convId = created?.id ?? null;
  }

  // Persist the latest visitor message.
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (convId && lastUser) {
    const content = textOf(lastUser);
    if (content) {
      await admin.from("chat_messages").insert({
        conversation_id: convId,
        role: "user",
        content,
      });
    }
  }

  // ---- Retrieval: ground the reply in the client's own website content ----
  // Without this the model has no site knowledge and will confidently invent
  // (or deny) details "from the website".
  let systemPrompt = tenant.system_prompt;
  const question = lastUser ? textOf(lastUser) : "";

  if (question) {
    const [queryVector] = await embedTexts([question], "RETRIEVAL_QUERY");

    if (queryVector) {
      const { data: matches } = await admin.rpc("match_documents", {
        p_tenant_id: tenantId,
        p_embedding: JSON.stringify(queryVector),
        p_match_count: 6,
      });

      const hits = (matches ?? []) as {
        url: string;
        title: string | null;
        content: string;
        similarity: number;
      }[];

      const useful = hits.filter((h) => h.similarity > 0.35);

      if (useful.length > 0) {
        const context = useful
          .map((h, i) => `[${i + 1}] ${h.title || h.url}\n${h.content}`)
          .join("\n\n---\n\n");

        systemPrompt =
          `${tenant.system_prompt}\n\n` +
          `## Website content\n` +
          `The excerpts below were taken from this business's own website. Answer ` +
          `using them whenever they are relevant, and treat them as the source of ` +
          `truth about the business. If the answer genuinely isn't in them, say you ` +
          `don't have that detail and offer to pass the question to the team — ` +
          `never invent specifics such as prices, dates, names, or policies.\n\n` +
          context;
      } else {
        systemPrompt =
          `${tenant.system_prompt}\n\n` +
          `## Note\n` +
          `No website content matched this question. Do not claim to be reading ` +
          `the website. Answer only from what you genuinely know, and offer to ` +
          `connect the visitor with the team for specifics.`;
      }
    }
  }

  const result = streamText({
    model: google("gemini-2.5-flash"),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    // Fires once the full reply has streamed — log it and bump the conversation.
    onEnd: async ({ text }) => {
      if (!convId || !text) return;
      await admin.from("chat_messages").insert({
        conversation_id: convId,
        role: "assistant",
        content: text,
      });
      await admin
        .from("conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", convId);
    },
  });

  // Surface the conversation id so the widget can keep appending to this thread.
  return result.toUIMessageStreamResponse({
    headers: convId ? { "x-conversation-id": convId } : undefined,
  });
}

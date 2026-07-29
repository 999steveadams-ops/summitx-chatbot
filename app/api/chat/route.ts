import { google } from "@ai-sdk/google";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createAdminClient } from "@/lib/supabase/admin";

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

  const result = streamText({
    model: google("gemini-2.5-flash"),
    system: tenant.system_prompt,
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

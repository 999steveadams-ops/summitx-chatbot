import { google } from "@ai-sdk/google";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  type UIMessage,
} from "ai";
import { createAdminClient } from "@/lib/supabase/admin";
import { embedTexts } from "@/lib/crawler";
import { esc, sendEmail } from "@/lib/email";

// Allow streamed responses up to 30 seconds.
export const maxDuration = 30;

// Rate limiting per visitor, per tenant, per rolling hour.
const RATE_LIMIT = 15; // messages before the grace window opens
const RATE_GRACE = 3; // extra messages allowed after the limit, then blocked

type ChatBody = {
  messages: UIMessage[];
  tenantId?: string;
  conversationId?: string;
  visitorId?: string;
};

function textOf(message: UIMessage): string {
  return message.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { text: string }).text)
    .join("");
}

/** A canned reply that does NOT call Gemini (used when a visitor is blocked). */
function cannedReply(text: string) {
  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      writer.write({ type: "text-start", id: "0" });
      writer.write({ type: "text-delta", id: "0", delta: text });
      writer.write({ type: "text-end", id: "0" });
    },
  });
  return createUIMessageStreamResponse({ stream });
}

export async function POST(req: Request) {
  const { messages, tenantId, conversationId, visitorId }: ChatBody =
    await req.json();

  if (!tenantId) return new Response("Missing tenantId", { status: 400 });

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;

  const admin = createAdminClient();
  const { data: tenant, error } = await admin
    .from("tenants")
    .select("system_prompt, business_name, notification_email")
    .eq("id", tenantId)
    .single();

  if (error || !tenant) return new Response("Unknown tenant", { status: 404 });

  // ---- Resolve the conversation (widget generates a stable id per session) ----
  let convId: string | null = null;
  const isUuid =
    !!conversationId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conversationId);

  if (isUuid) {
    const { data: existing } = await admin
      .from("conversations")
      .select("id, tenant_id, flagged")
      .eq("id", conversationId)
      .maybeSingle();
    if (existing) {
      if (existing.tenant_id === tenantId) convId = existing.id;
    } else {
      const { data: created } = await admin
        .from("conversations")
        .insert({ id: conversationId, tenant_id: tenantId, visitor_id: visitorId ?? null, ip })
        .select("id")
        .single();
      convId = created?.id ?? null;
    }
  }
  if (!convId) {
    const { data: created } = await admin
      .from("conversations")
      .insert({ tenant_id: tenantId, visitor_id: visitorId ?? null, ip })
      .select("id")
      .single();
    convId = created?.id ?? null;
  }

  // ---- Rate limiting (by visitor, this tenant, last hour) ----
  if (visitorId) {
    const since = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await admin
      .from("chat_messages")
      .select("id, conversations!inner(tenant_id, visitor_id)", {
        count: "exact",
        head: true,
      })
      .eq("role", "user")
      .gte("created_at", since)
      .eq("conversations.tenant_id", tenantId)
      .eq("conversations.visitor_id", visitorId);

    const priorUserMsgs = count ?? 0;

    // Hard block once past the grace window — do NOT spend Gemini quota.
    if (priorUserMsgs >= RATE_LIMIT + RATE_GRACE) {
      return cannedReply(
        "You've reached the message limit for now. Please reach out to the team directly and we'll be happy to help.",
      );
    }

    // Entered the grace window: alert the agency once per conversation.
    if (priorUserMsgs >= RATE_LIMIT && convId) {
      const { data: conv } = await admin
        .from("conversations")
        .select("flagged")
        .eq("id", convId)
        .maybeSingle();
      if (conv && !conv.flagged) {
        await admin.from("conversations").update({ flagged: true }).eq("id", convId);
        const agency = process.env.AGENCY_NOTIFICATION_EMAIL;
        if (agency) {
          await sendEmail({
            to: agency,
            subject: `[SummitX] Possible spam on ${tenant.business_name}`,
            html:
              `<p>A visitor has crossed the message limit and is in the grace window.</p>` +
              `<ul><li><b>Business:</b> ${esc(tenant.business_name)}</li>` +
              `<li><b>Visitor:</b> ${esc(visitorId)}</li>` +
              `<li><b>IP:</b> ${esc(ip)}</li>` +
              `<li><b>Messages in last hour:</b> ${priorUserMsgs}</li></ul>`,
          });
        }
      }
    }
  }

  // Persist the latest visitor message.
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const question = lastUser ? textOf(lastUser) : "";
  if (convId && question) {
    await admin
      .from("chat_messages")
      .insert({ conversation_id: convId, role: "user", content: question });
  }

  // ---- Retrieval: ground the reply in the client's own website content ----
  let systemPrompt = tenant.system_prompt;
  let grounded = false;

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
      grounded = useful.length > 0;

      if (grounded) {
        const context = useful
          .map((h, i) => `[${i + 1}] ${h.title || h.url}\n${h.content}`)
          .join("\n\n---\n\n");
        systemPrompt =
          `${tenant.system_prompt}\n\n## Website content\n` +
          `The excerpts below were taken from this business's own website. Answer ` +
          `using them whenever they are relevant, and treat them as the source of ` +
          `truth about the business. If the answer genuinely isn't in them, say you ` +
          `don't have that detail and offer to pass the question to the team — ` +
          `never invent specifics such as prices, dates, names, or policies.\n\n` +
          context;
      } else {
        systemPrompt =
          `${tenant.system_prompt}\n\n## Note\n` +
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
    onEnd: async ({ text }) => {
      if (!convId || !text) return;
      await admin.from("chat_messages").insert({
        conversation_id: convId,
        role: "assistant",
        content: text,
        answered_from_kb: grounded,
      });
      await admin
        .from("conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", convId);
    },
  });

  return result.toUIMessageStreamResponse({
    headers: convId ? { "x-conversation-id": convId } : undefined,
  });
}

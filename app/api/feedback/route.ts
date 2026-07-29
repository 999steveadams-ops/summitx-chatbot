import { createAdminClient } from "@/lib/supabase/admin";

type FeedbackBody = {
  tenantId?: string;
  conversationId?: string;
  messageIndex?: number;
  rating?: "up" | "down";
};

export async function POST(req: Request) {
  const { tenantId, conversationId, messageIndex, rating }: FeedbackBody =
    await req.json();

  if (!tenantId || !conversationId || rating !== "up" && rating !== "down") {
    return Response.json({ error: "Invalid feedback." }, { status: 400 });
  }
  if (typeof messageIndex !== "number" || messageIndex < 0) {
    return Response.json({ error: "Invalid message index." }, { status: 400 });
  }

  const admin = createAdminClient();

  // Confirm the conversation belongs to this tenant before recording.
  const { data: conv } = await admin
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!conv) return Response.json({ error: "Unknown conversation" }, { status: 404 });

  // One rating per (conversation, message). Upsert so a visitor can change it.
  const { error } = await admin
    .from("chat_feedback")
    .upsert(
      {
        tenant_id: tenantId,
        conversation_id: conversationId,
        message_index: messageIndex,
        rating,
      },
      { onConflict: "conversation_id,message_index" },
    );

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

import { google } from "@ai-sdk/google";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createAdminClient } from "@/lib/supabase/admin";

// Allow streamed responses up to 30 seconds.
export const maxDuration = 30;

type ChatBody = {
  messages: UIMessage[];
  tenantId?: string;
};

export async function POST(req: Request) {
  const { messages, tenantId }: ChatBody = await req.json();

  if (!tenantId) {
    return new Response("Missing tenantId", { status: 400 });
  }

  // Read the tenant's PRIVATE system prompt server-side, via the service role.
  // This value is used only as the model's `system` instruction and is never
  // returned to the browser.
  const admin = createAdminClient();
  const { data: tenant, error } = await admin
    .from("tenants")
    .select("system_prompt, business_name")
    .eq("id", tenantId)
    .single();

  if (error || !tenant) {
    return new Response("Unknown tenant", { status: 404 });
  }

  const result = streamText({
    model: google("gemini-2.0-flash"),
    system: tenant.system_prompt,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}

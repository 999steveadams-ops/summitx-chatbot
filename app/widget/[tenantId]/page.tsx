import { createAdminClient } from "@/lib/supabase/admin";
import ChatWidget from "./ChatWidget";

// The widget is embedded in a cross-site iframe and must always render fresh.
export const dynamic = "force-dynamic";

export default async function WidgetPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  // Next.js 16: params is a Promise.
  const { tenantId } = await params;

  // Public path: read ONLY the safe, brandable fields. `system_prompt` is never
  // selected here, so it can never reach the browser.
  const admin = createAdminClient();
  const { data: tenant } = await admin
    .from("tenants")
    .select("business_name, brand_color, logo_url, greeting_message, starter_questions")
    .eq("id", tenantId)
    .single();

  if (!tenant) {
    return (
      <div className="flex h-full items-center justify-center bg-white p-6 text-center text-sm text-zinc-500">
        This chat widget isn&apos;t available.
      </div>
    );
  }

  const starters = Array.isArray(tenant.starter_questions)
    ? (tenant.starter_questions as unknown[]).filter(
        (q): q is string => typeof q === "string" && q.trim().length > 0,
      )
    : [];

  return (
    <ChatWidget
      tenantId={tenantId}
      businessName={tenant.business_name}
      brandColor={tenant.brand_color}
      logoUrl={tenant.logo_url ?? null}
      greeting={tenant.greeting_message ?? null}
      starterQuestions={starters}
    />
  );
}

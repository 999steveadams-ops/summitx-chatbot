import { createAdminClient } from "@/lib/supabase/admin";
import { esc, sendEmail } from "@/lib/email";

type LeadBody = {
  tenantId?: string;
  conversationId?: string;
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
};

export async function POST(req: Request) {
  const body: LeadBody = await req.json();
  const { tenantId } = body;

  if (!tenantId) return Response.json({ error: "Missing tenantId" }, { status: 400 });

  const name = (body.name ?? "").trim().slice(0, 200);
  const email = (body.email ?? "").trim().slice(0, 200);
  const phone = (body.phone ?? "").trim().slice(0, 60);
  const message = (body.message ?? "").trim().slice(0, 2000);

  if (!email && !phone) {
    return Response.json({ error: "Email or phone is required." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: tenant } = await admin
    .from("tenants")
    .select("business_name, notification_email")
    .eq("id", tenantId)
    .single();
  if (!tenant) return Response.json({ error: "Unknown tenant" }, { status: 404 });

  const isUuid =
    !!body.conversationId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      body.conversationId,
    );

  const { error } = await admin.from("leads").insert({
    tenant_id: tenantId,
    conversation_id: isUuid ? body.conversationId : null,
    name: name || null,
    email: email || null,
    phone: phone || null,
    message: message || null,
  });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Notify the client and the agency SEPARATELY (best-effort — the lead is
  // already saved). Sending separately means one failing recipient (e.g. an
  // address Resend won't send to before a domain is verified) doesn't block the
  // other. The agency address is usually the Resend account owner, so it works
  // even in test mode.
  const subject = `New lead from your ${tenant.business_name} chatbot`;
  const html =
    `<h2>New lead from your website chatbot</h2>` +
    `<p><b>Business:</b> ${esc(tenant.business_name)}</p>` +
    `<ul>` +
    `<li><b>Name:</b> ${esc(name) || "—"}</li>` +
    `<li><b>Email:</b> ${esc(email) || "—"}</li>` +
    `<li><b>Phone:</b> ${esc(phone) || "—"}</li>` +
    (message ? `<li><b>Message:</b> ${esc(message)}</li>` : "") +
    `</ul>`;

  const targets = [tenant.notification_email, process.env.AGENCY_NOTIFICATION_EMAIL].filter(
    (e): e is string => !!e && e.includes("@"),
  );
  await Promise.all(targets.map((to) => sendEmail({ to, subject, html })));

  return Response.json({ ok: true });
}

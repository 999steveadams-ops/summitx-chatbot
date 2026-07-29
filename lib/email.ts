import "server-only";

/**
 * Minimal Resend email sender (no SDK — just the REST API).
 *
 * Degrades gracefully: if RESEND_API_KEY is not set, this is a no-op that returns
 * `{ sent: false }`, so lead capture and spam alerts still work (stored in-app)
 * without email configured.
 *
 * Setup: set RESEND_API_KEY, and optionally RESEND_FROM (a verified sender like
 * "SummitX <alerts@yourdomain.com>"; defaults to Resend's shared test sender).
 */
export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
}): Promise<{ sent: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false, error: "RESEND_API_KEY not set" };

  const to = (Array.isArray(opts.to) ? opts.to : [opts.to])
    .map((e) => e.trim())
    .filter(Boolean);
  if (to.length === 0) return { sent: false, error: "no recipients" };

  const from = process.env.RESEND_FROM || "SummitX ChatBot <onboarding@resend.dev>";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({ from, to, subject: opts.subject, html: opts.html }),
    });
    if (!res.ok) {
      return { sent: false, error: `Resend ${res.status}: ${await res.text()}` };
    }
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : "send failed" };
  }
}

/** Basic HTML escaping for values interpolated into email bodies. */
export function esc(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

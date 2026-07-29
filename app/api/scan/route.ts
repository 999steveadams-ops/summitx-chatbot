import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { chunkText, discoverUrls, embedTexts, scrapePage } from "@/lib/crawler";

// Crawling + embedding is slow; give it the longest window we can.
export const maxDuration = 300;

export async function POST(req: Request) {
  // Staff only — scanning burns API quota and rewrites a tenant's knowledge base.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not signed in." }, { status: 401 });

  const admin = createAdminClient();
  const { data: isStaff } = await admin
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!isStaff) {
    return Response.json({ error: "Staff only." }, { status: 403 });
  }

  const { tenantId, websiteUrl } = (await req.json()) as {
    tenantId?: string;
    websiteUrl?: string;
  };

  if (!tenantId || !websiteUrl) {
    return Response.json(
      { error: "tenantId and websiteUrl are required." },
      { status: 400 },
    );
  }

  let root: URL;
  try {
    root = new URL(websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`);
  } catch {
    return Response.json({ error: "That website URL isn't valid." }, { status: 400 });
  }

  // 1. Find pages
  const urls = await discoverUrls(root.href);
  if (urls.length === 0) {
    return Response.json(
      { error: "Couldn't reach that website or find any pages to read." },
      { status: 422 },
    );
  }

  // 2. Fetch + clean, then chunk
  type Pending = { url: string; title: string; content: string };
  const pending: Pending[] = [];

  for (const url of urls) {
    const page = await scrapePage(url);
    if (!page) continue;
    for (const content of chunkText(page.text)) {
      pending.push({ url: page.url, title: page.title, content });
    }
  }

  if (pending.length === 0) {
    return Response.json(
      { error: "Reached the site but found no readable text." },
      { status: 422 },
    );
  }

  // 3. Embed
  const vectors = await embedTexts(
    pending.map((p) => p.content),
    "RETRIEVAL_DOCUMENT",
  );

  const rows = pending
    .map((p, i) => ({ ...p, tenant_id: tenantId, embedding: vectors[i] }))
    .filter((r) => r.embedding !== null);

  if (rows.length === 0) {
    return Response.json(
      { error: "Couldn't generate embeddings — check the Gemini API key/quota." },
      { status: 502 },
    );
  }

  // 4. Replace the old knowledge base atomically enough for our purposes:
  //    delete previous rows, then insert the fresh set.
  await admin.from("documents").delete().eq("tenant_id", tenantId);

  const BATCH = 100;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await admin.from("documents").insert(rows.slice(i, i + BATCH));
    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    inserted += Math.min(BATCH, rows.length - i);
  }

  await admin
    .from("tenants")
    .update({ website_url: root.href, last_scanned_at: new Date().toISOString() })
    .eq("id", tenantId);

  const pages = new Set(rows.map((r) => r.url)).size;
  return Response.json({ ok: true, pages, chunks: inserted });
}

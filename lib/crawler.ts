import "server-only";

/** Max pages fetched in one scan — keeps us inside the serverless time limit. */
export const MAX_PAGES = 30;
const CHUNK_SIZE = 1500;
const CHUNK_OVERLAP = 200;
const FETCH_TIMEOUT_MS = 12000;

const EMBED_MODEL = "gemini-embedding-001";
export const EMBED_DIMS = 768;

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "SummitXChatBot/1.0 (+website indexer)" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "follow",
    });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("text/html") && !type.includes("xml")) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** Strip scripts/styles/markup and collapse whitespace into readable text. */
export function htmlToText(html: string): { title: string; text: string } {
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const title = decode(titleMatch?.[1] ?? "").trim().slice(0, 200);

  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    // Keep block boundaries so sentences don't run together.
    .replace(/<\/(p|div|section|article|li|h[1-6]|br|tr|td)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  const text = decode(body)
    .replace(/[ \t ]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n")
    .trim();

  return { title, text };
}

function decode(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&rsquo;/gi, "'")
    .replace(/&ldquo;|&rdquo;/gi, '"')
    .replace(/&mdash;/gi, "—")
    .replace(/&ndash;/gi, "–")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

/** Split long text into overlapping chunks on sentence-ish boundaries. */
export function chunkText(text: string): string[] {
  if (text.length <= CHUNK_SIZE) return text.trim() ? [text.trim()] : [];

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + CHUNK_SIZE, text.length);

    if (end < text.length) {
      // Prefer to break at a paragraph or sentence end near the limit.
      const window = text.slice(start, end);
      const br = Math.max(
        window.lastIndexOf("\n\n"),
        window.lastIndexOf(". "),
        window.lastIndexOf("\n"),
      );
      if (br > CHUNK_SIZE * 0.5) end = start + br + 1;
    }

    const piece = text.slice(start, end).trim();
    if (piece) chunks.push(piece);

    if (end >= text.length) break;
    start = Math.max(start + 1, end - CHUNK_OVERLAP);
  }

  return chunks;
}

/** Collect same-origin page URLs, preferring sitemap.xml over link crawling. */
export async function discoverUrls(rootUrl: string): Promise<string[]> {
  const root = new URL(rootUrl);
  const origin = root.origin;
  const found = new Set<string>([stripHash(root.href)]);

  // 1) sitemap.xml (and one level of sitemap indexes)
  for (const path of ["/sitemap.xml", "/sitemap_index.xml", "/wp-sitemap.xml"]) {
    const xml = await fetchText(origin + path);
    if (!xml) continue;

    const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]);

    // Sitemap indexes often list builder-generated stubs (Elementor jkit
    // headers/footers, form templates) alongside real content. Read the
    // content sitemaps first so the page budget isn't spent on boilerplate.
    const nested = locs
      .filter((u) => /\.xml($|\?)/i.test(u))
      .sort((a, b) => rankSitemap(a) - rankSitemap(b))
      .slice(0, 5);
    for (const u of locs.filter((u) => !/\.xml($|\?)/i.test(u))) {
      if (sameOrigin(u, origin)) found.add(stripHash(u));
    }
    for (const sm of nested) {
      const sub = await fetchText(sm);
      if (!sub) continue;
      for (const m of sub.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) {
        if (sameOrigin(m[1], origin) && !/\.xml($|\?)/i.test(m[1])) {
          found.add(stripHash(m[1]));
        }
      }
    }
    if (found.size > 1) break;
  }

  // 2) Fall back to links on the homepage.
  if (found.size <= 1) {
    const html = await fetchText(root.href);
    if (html) {
      for (const m of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
        try {
          const abs = new URL(m[1], root.href);
          if (abs.origin === origin && !isAsset(abs.pathname)) {
            found.add(stripHash(abs.href));
          }
        } catch {
          /* ignore malformed hrefs */
        }
      }
    }
  }

  // Big WordPress sites carry hundreds of near-duplicate location landing
  // pages. Spend the page budget on the core pages a visitor actually asks
  // about (home, services, pricing, about, contact) before those.
  return [...found]
    .filter((u) => !isAsset(u))
    .sort((a, b) => rankPage(a, origin) - rankPage(b, origin))
    .slice(0, MAX_PAGES);
}

/** Lower is better. */
function rankPage(u: string, origin: string): number {
  let path: string;
  try {
    path = new URL(u).pathname.toLowerCase();
  } catch {
    return 50;
  }

  if (u === origin || path === "/") return 0;
  if (/(service|package|pricing|price|rate|faq|about|contact|equipment)/.test(path)) {
    return 1;
  }
  if (/(thank-you|privacy|terms|cart|checkout|login|author|tag|category)/.test(path)) {
    return 40;
  }
  // Prefer shallower URLs; city/landing pages tend to be deeper or hyphen-heavy.
  const depth = path.split("/").filter(Boolean).length;
  const hyphens = (path.match(/-/g) ?? []).length;
  return 5 + depth + Math.min(hyphens, 8);
}

/** Lower is better: real pages/posts first, page-builder stubs last. */
function rankSitemap(u: string): number {
  if (/page-sitemap/i.test(u)) return 0;
  if (/post-sitemap/i.test(u)) return 1;
  if (/(jkit|metform|elementor|_library|attachment|author|tag)/i.test(u)) return 9;
  return 5;
}

function sameOrigin(u: string, origin: string): boolean {
  try {
    return new URL(u).origin === origin;
  } catch {
    return false;
  }
}

function stripHash(u: string): string {
  try {
    const url = new URL(u);
    url.hash = "";
    return url.href;
  } catch {
    return u;
  }
}

function isAsset(u: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|svg|ico|css|js|pdf|zip|mp4|mp3|woff2?|ttf|xml)($|\?)/i.test(
    u,
  );
}

/** Fetch a page and return its cleaned text. */
export async function scrapePage(
  url: string,
): Promise<{ url: string; title: string; text: string } | null> {
  const html = await fetchText(url);
  if (!html) return null;
  const { title, text } = htmlToText(html);
  if (text.length < 80) return null; // skip near-empty pages
  return { url, title, text };
}

/** Embed a batch of strings with Gemini. Returns null entries on failure. */
export async function embedTexts(
  texts: string[],
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY",
): Promise<(number[] | null)[]> {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) return texts.map(() => null);

  const out: (number[] | null)[] = [];

  // The batch endpoint caps request size, so send in modest groups.
  const GROUP = 20;
  for (let i = 0; i < texts.length; i += GROUP) {
    const group = texts.slice(i, i + GROUP);
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:batchEmbedContents?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(30000),
          body: JSON.stringify({
            requests: group.map((t) => ({
              model: `models/${EMBED_MODEL}`,
              content: { parts: [{ text: t.slice(0, 8000) }] },
              taskType,
              outputDimensionality: EMBED_DIMS,
            })),
          }),
        },
      );

      if (!res.ok) {
        out.push(...group.map(() => null));
        continue;
      }
      const json = (await res.json()) as {
        embeddings?: { values: number[] }[];
      };
      const vecs = json.embeddings ?? [];
      for (let j = 0; j < group.length; j++) {
        out.push(vecs[j]?.values ?? null);
      }
    } catch {
      out.push(...group.map(() => null));
    }
  }

  return out;
}

import * as cheerio from "cheerio";
import { fetchAndParseUrl, timedFetch, type FetchedPage } from "./fetchPage";

const MAX_NESTED_SITEMAPS = 5;
const MAX_CRAWL_DEPTH = 3;
const CRAWL_CONCURRENCY = 4;

const SKIP_EXTENSIONS =
  /\.(pdf|jpe?g|png|gif|svg|webp|avif|ico|css|js|mjs|json|xml|zip|rar|7z|gz|tar|mp4|mp3|wav|avi|mov|wmv|woff2?|ttf|eot|otf|doc|docx|xls|xlsx|ppt|pptx|csv)(?:[?#]|$)/i;

/** Runs `fn` over `items` with at most `concurrency` in flight at once. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, () => worker());
  await Promise.all(workers);
  return results;
}

function shouldSkipUrl(rawUrl: string, originHost: string): boolean {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return true;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return true;
  if (u.hostname !== originHost) return true;
  if (SKIP_EXTENSIONS.test(u.pathname)) return true;
  return false;
}

function normalizeUrl(rawUrl: string): string {
  const u = new URL(rawUrl);
  u.hash = "";
  let pathname = u.pathname;
  if (pathname.length > 1 && pathname.endsWith("/")) pathname = pathname.slice(0, -1);
  return `${u.protocol}//${u.hostname}${pathname}${u.search}`;
}

function dedupeUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    let norm: string;
    try {
      norm = normalizeUrl(raw);
    } catch {
      continue;
    }
    if (seen.has(norm)) continue;
    seen.add(norm);
    out.push(norm);
  }
  return out;
}

interface SitemapLocs {
  locs: string[];
  isIndex: boolean;
}

async function fetchSitemapLocs(url: string): Promise<SitemapLocs | null> {
  let res: Response;
  try {
    res = await timedFetch(url);
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType && !contentType.includes("xml") && !contentType.includes("text")) return null;

  const xml = await res.text();
  const $ = cheerio.load(xml, { xmlMode: true });
  const isIndex = $("sitemapindex").length > 0;
  const locs = $("loc")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean);
  return { locs, isIndex };
}

/** Tries to discover page URLs from /sitemap.xml (following one level of sitemap index). Returns null if no usable sitemap exists. */
export async function discoverSitemapUrls(origin: string, limit: number): Promise<string[] | null> {
  const primary = await fetchSitemapLocs(`${origin}/sitemap.xml`);
  if (!primary) return null;

  let locs = primary.locs;
  if (primary.isIndex) {
    const collected: string[] = [];
    for (const nestedUrl of locs.slice(0, MAX_NESTED_SITEMAPS)) {
      const sub = await fetchSitemapLocs(nestedUrl);
      if (sub && !sub.isIndex) collected.push(...sub.locs);
      if (collected.length >= limit) break;
    }
    locs = collected;
  }

  const originHost = new URL(origin).hostname;
  const filtered = dedupeUrls(locs.filter((u) => !shouldSkipUrl(u, originHost)));
  return filtered.length ? filtered : null;
}

/**
 * Breadth-first crawl of internal links starting at `startUrl`, used when no sitemap is available.
 * Fetched pages are stashed in `fetchedCache` so callers can reuse them instead of re-fetching.
 */
export async function crawlDiscover(
  startUrl: string,
  maxPages: number,
  fetchedCache: Map<string, FetchedPage>
): Promise<string[]> {
  const originHost = new URL(startUrl).hostname;
  const visited = new Set<string>([normalizeUrl(startUrl)]);
  let frontier = [startUrl];
  const order: string[] = [];

  for (let depth = 0; depth < MAX_CRAWL_DEPTH && frontier.length && order.length < maxPages; depth++) {
    const batchSize = Math.min(frontier.length, Math.max(maxPages - order.length, 1) + CRAWL_CONCURRENCY);
    const batch = frontier.slice(0, batchSize);

    const fetchedList = await mapWithConcurrency(batch, CRAWL_CONCURRENCY, async (u) => {
      try {
        return await fetchAndParseUrl(u);
      } catch {
        return null;
      }
    });

    const nextFrontier = new Set<string>();
    for (const fetched of fetchedList) {
      if (!fetched || order.length >= maxPages) continue;
      fetchedCache.set(fetched.finalUrl, fetched);
      order.push(fetched.finalUrl);

      for (const link of fetched.parsed.links) {
        if (!link.internal) continue;
        let abs: string;
        try {
          abs = new URL(link.href, fetched.finalUrl).toString();
        } catch {
          continue;
        }
        if (shouldSkipUrl(abs, originHost)) continue;
        const norm = normalizeUrl(abs);
        if (visited.has(norm)) continue;
        visited.add(norm);
        nextFrontier.add(abs);
      }
    }
    frontier = Array.from(nextFrontier);
  }

  return order;
}

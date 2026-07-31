import { fetchAndParseUrl, FetchPageError, type FetchedPage } from "./fetchPage";
import { analyzeFetchedPage } from "./analyze";
import { discoverSitemapUrls, crawlDiscover, mapWithConcurrency } from "./siteCrawl";
import type { PageType, SiteIssueSummary, SiteScanPageResult, SiteScanSummary } from "./types";

export { FetchPageError };

const DEFAULT_MAX_PAGES = 15;
const MAX_MAX_PAGES = 40;
const SCORE_CONCURRENCY = 4;

export interface SiteScanInput {
  url?: string;
  pageType: PageType;
  targetKeyword?: string | null;
  maxPages?: number;
}

export async function scanSite(input: SiteScanInput): Promise<SiteScanSummary> {
  if (!input.url) throw new FetchPageError("A URL is required.");
  let start: URL;
  try {
    start = new URL(input.url);
  } catch {
    throw new FetchPageError("That doesn't look like a valid URL.");
  }
  if (start.protocol !== "http:" && start.protocol !== "https:") {
    throw new FetchPageError("Only http:// and https:// URLs are supported.");
  }

  const origin = start.origin;
  const maxPages = Math.min(
    Math.max(Math.round(input.maxPages ?? DEFAULT_MAX_PAGES) || DEFAULT_MAX_PAGES, 1),
    MAX_MAX_PAGES
  );
  const targetKeyword = input.targetKeyword?.trim() || null;
  const opts = { pageType: input.pageType, targetKeyword };

  const fetchedCache = new Map<string, FetchedPage>();
  let discoveryMethod: "sitemap" | "crawl" = "sitemap";
  let urls = await discoverSitemapUrls(origin, maxPages * 2);

  if (!urls || urls.length < 2) {
    discoveryMethod = "crawl";
    urls = await crawlDiscover(start.toString(), maxPages, fetchedCache);
  }

  if (!urls.length) {
    // Sitemap/crawl both came up empty (e.g. link-free landing page) — fall back to just the start URL.
    urls = [start.toString()];
  }

  const truncated = urls.length > maxPages;
  urls = urls.slice(0, maxPages);

  const pages = await mapWithConcurrency(urls, SCORE_CONCURRENCY, async (url): Promise<SiteScanPageResult> => {
    try {
      const fetched = fetchedCache.get(url) ?? (await fetchAndParseUrl(url));
      const results = analyzeFetchedPage(fetched, opts);
      return {
        url: results.meta.fetchedUrl ?? url,
        title: results.meta.title,
        wordCount: results.meta.wordCount,
        seoScore: results.seoScore,
        geoScore: results.geoScore,
        seoCategories: results.seoCategories,
        geoCategories: results.geoCategories,
        error: null,
      };
    } catch (err) {
      return {
        url,
        title: null,
        wordCount: null,
        seoScore: null,
        geoScore: null,
        error: err instanceof Error ? err.message : "Failed to analyze that page.",
      };
    }
  });

  const scored = pages.filter((p) => p.seoScore !== null && p.geoScore !== null);
  const avgSeoScore = scored.length
    ? Math.round(scored.reduce((s, p) => s + (p.seoScore ?? 0), 0) / scored.length)
    : null;
  const avgGeoScore = scored.length
    ? Math.round(scored.reduce((s, p) => s + (p.geoScore ?? 0), 0) / scored.length)
    : null;

  return {
    startUrl: start.toString(),
    origin,
    discoveryMethod,
    pagesScanned: pages.length,
    truncated,
    avgSeoScore,
    avgGeoScore,
    topIssues: summarizeIssues(pages),
    pages,
  };
}

function summarizeIssues(pages: SiteScanPageResult[]): SiteIssueSummary[] {
  const tally = new Map<string, SiteIssueSummary>();

  for (const page of pages) {
    const groups: Array<["seo" | "geo", SiteScanPageResult["seoCategories"]]> = [
      ["seo", page.seoCategories],
      ["geo", page.geoCategories],
    ];
    for (const [group, cats] of groups) {
      for (const cat of cats ?? []) {
        for (const check of cat.checks) {
          if (check.status === "pass") continue;
          const key = `${group}:${check.id}`;
          const entry = tally.get(key) ?? {
            id: check.id,
            label: check.label,
            category: group,
            failCount: 0,
            warnCount: 0,
            pagesAffected: 0,
          };
          entry.pagesAffected += 1;
          if (check.status === "fail") entry.failCount += 1;
          else entry.warnCount += 1;
          tally.set(key, entry);
        }
      }
    }
  }

  return Array.from(tally.values())
    .sort((a, b) => b.failCount * 2 + b.warnCount - (a.failCount * 2 + a.warnCount))
    .slice(0, 8);
}

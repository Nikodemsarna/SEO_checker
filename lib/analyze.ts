import { fetchAndParseUrl, FetchPageError } from "./fetchPage";
import { looksLikeHtml, parseHtml, parsePlainText } from "./parse";
import { runSeoChecks } from "./seoChecks";
import { runGeoChecks } from "./geoChecks";
import { scoreCategories } from "./checkHelpers";
import type { AnalysisResults, PageType } from "./types";

export { FetchPageError };

export interface AnalyzeInput {
  source: "url" | "paste";
  url?: string;
  content?: string;
  pageType: PageType;
  targetKeyword?: string | null;
}

export async function analyze(input: AnalyzeInput): Promise<AnalysisResults> {
  const targetKeyword = input.targetKeyword?.trim() || null;
  const opts = { pageType: input.pageType, targetKeyword };

  if (input.source === "url") {
    if (!input.url) throw new FetchPageError("A URL is required.");
    const { parsed, finalUrl, llmsTxtFound } = await fetchAndParseUrl(input.url);
    const seoCategories = runSeoChecks(parsed, opts);
    const geoCategories = runGeoChecks(parsed, { ...opts, llmsTxtFound });
    return {
      seoScore: scoreCategories(seoCategories),
      geoScore: scoreCategories(geoCategories),
      seoCategories,
      geoCategories,
      meta: {
        title: parsed.title,
        wordCount: parsed.wordCount,
        pageType: input.pageType,
        targetKeyword,
        source: "url",
        fetchedUrl: finalUrl,
      },
    };
  }

  const content = input.content ?? "";
  if (!content.trim()) throw new FetchPageError("Paste some content to analyze.");
  const parsed = looksLikeHtml(content) ? parseHtml(content, null) : parsePlainText(content);
  const seoCategories = runSeoChecks(parsed, opts);
  const geoCategories = runGeoChecks(parsed, opts);
  return {
    seoScore: scoreCategories(seoCategories),
    geoScore: scoreCategories(geoCategories),
    seoCategories,
    geoCategories,
    meta: {
      title: parsed.title,
      wordCount: parsed.wordCount,
      pageType: input.pageType,
      targetKeyword,
      source: "paste",
    },
  };
}

import * as cheerio from "cheerio";

export interface Heading {
  level: number;
  text: string;
}

export interface LinkInfo {
  href: string;
  text: string;
  internal: boolean;
}

export interface ImageInfo {
  src: string;
  alt: string | null;
}

export interface ParsedContent {
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  robotsMeta: string | null;
  viewportMeta: string | null;
  h1s: string[];
  headings: Heading[];
  bodyText: string;
  wordCount: number;
  firstParagraphText: string;
  paragraphTexts: string[];
  images: ImageInfo[];
  links: LinkInfo[];
  internalLinkCount: number;
  externalLinkCount: number;
  jsonLdTypes: string[];
  listCount: number;
  tableCount: number;
  hasArticleTag: boolean;
  hasSectionTag: boolean;
  authorSignal: boolean;
  lastUpdatedSignal: boolean;
  faqPairCount: number;
  statsCount: number;
  url: string | null;
}

const WORD_RE = /[A-Za-z0-9''-]+/g;

function countWords(text: string): number {
  const matches = text.match(WORD_RE);
  return matches ? matches.length : 0;
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function hostnameOf(href: string, base?: string): string | null {
  try {
    return new URL(href, base ?? undefined).hostname;
  } catch {
    return null;
  }
}

/** Parses raw HTML (fetched or pasted) into a structured content model shared by the SEO and GEO check engines. */
export function parseHtml(html: string, url: string | null = null): ParsedContent {
  const $ = cheerio.load(html);

  $("script, style, noscript, template").remove();

  const title = cleanText($("title").first().text()) || null;
  const metaDescription =
    $('meta[name="description"]').attr("content")?.trim() || null;
  const canonical = $('link[rel="canonical"]').attr("href")?.trim() || null;
  const robotsMeta = $('meta[name="robots"]').attr("content")?.trim() || null;
  const viewportMeta = $('meta[name="viewport"]').attr("content")?.trim() || null;

  const h1s = $("h1")
    .map((_, el) => cleanText($(el).text()))
    .get()
    .filter(Boolean);

  const headings: Heading[] = [];
  $("h1, h2, h3, h4, h5, h6").each((_, el) => {
    const level = Number(el.tagName.slice(1));
    const text = cleanText($(el).text());
    if (text) headings.push({ level, text });
  });

  const bodyRoot = $("main").length ? $("main") : $("body");
  const bodyText = cleanText(bodyRoot.text());
  const wordCount = countWords(bodyText);

  const firstParagraphText = cleanText($("p").first().text() || "");
  const paragraphTexts = $("p")
    .map((_, el) => cleanText($(el).text()))
    .get()
    .filter((t) => t.length > 0);

  const images: ImageInfo[] = $("img")
    .map((_, el) => ({
      src: $(el).attr("src") || "",
      alt: $(el).attr("alt") ?? null,
    }))
    .get();

  const baseHostname = url ? hostnameOf(url) : null;
  const links: LinkInfo[] = $("a[href]")
    .map((_, el) => {
      const href = $(el).attr("href") || "";
      const text = cleanText($(el).text());
      const h = hostnameOf(href, url ?? undefined);
      const internal = href.startsWith("#") || href.startsWith("/") || (!!h && !!baseHostname && h === baseHostname);
      return { href, text, internal };
    })
    .get()
    .filter((l) => l.href && !l.href.startsWith("#"));

  const internalLinkCount = links.filter((l) => l.internal).length;
  const externalLinkCount = links.filter((l) => !l.internal).length;

  const jsonLdTypes: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    try {
      const data = JSON.parse(raw);
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        const graph = item["@graph"] ?? [item];
        for (const node of Array.isArray(graph) ? graph : [graph]) {
          const t = node?.["@type"];
          if (typeof t === "string") jsonLdTypes.push(t);
          else if (Array.isArray(t)) jsonLdTypes.push(...t);
        }
      }
    } catch {
      // malformed JSON-LD, ignore
    }
  });

  const listCount = $("ul, ol").length;
  const tableCount = $("table").length;
  const hasArticleTag = $("article").length > 0;
  const hasSectionTag = $("section").length > 0;

  const authorSignal =
    $('[rel="author"], [itemprop="author"], .author, .byline, [class*="author"]').length > 0 ||
    /\bby\s+[A-Z][a-z]+\s+[A-Z][a-z]+/.test(bodyText);

  const lastUpdatedSignal =
    $("time").length > 0 ||
    /\b(last updated|updated on|reviewed on|reviewed by)\b/i.test(bodyText);

  let faqPairCount = 0;
  headings.forEach((h) => {
    if (h.text.trim().endsWith("?")) faqPairCount++;
  });
  if (jsonLdTypes.includes("FAQPage")) faqPairCount = Math.max(faqPairCount, 1);

  const statsMatches = bodyText.match(/\b\d[\d,.]*\s?%?|\$\d[\d,.]*/g);
  const statsCount = statsMatches ? statsMatches.length : 0;

  return {
    title,
    metaDescription,
    canonical,
    robotsMeta,
    viewportMeta,
    h1s,
    headings,
    bodyText,
    wordCount,
    firstParagraphText,
    paragraphTexts,
    images,
    links,
    internalLinkCount,
    externalLinkCount,
    jsonLdTypes,
    listCount,
    tableCount,
    hasArticleTag,
    hasSectionTag,
    authorSignal,
    lastUpdatedSignal,
    faqPairCount,
    statsCount,
    url,
  };
}

/** Wraps plain-text/markdown paste (no HTML tags) into a minimal document so the same parser can score it. */
export function parsePlainText(text: string): ParsedContent {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const titleLine = lines[0] ?? "";
  const html = [
    "<html><head>",
    titleLine ? `<title>${escapeHtml(titleLine)}</title>` : "",
    "</head><body>",
    lines
      .map((line, i) => {
        if (i === 0) return `<h1>${escapeHtml(line)}</h1>`;
        if (/^#{1,6}\s/.test(line)) {
          const level = Math.min(6, line.match(/^#+/)?.[0].length ?? 2);
          return `<h${level}>${escapeHtml(line.replace(/^#{1,6}\s/, ""))}</h${level}>`;
        }
        if (/^[-*]\s/.test(line)) return `<li>${escapeHtml(line.replace(/^[-*]\s/, ""))}</li>`;
        return `<p>${escapeHtml(line)}</p>`;
      })
      .join("\n"),
    "</body></html>",
  ].join("\n");
  return parseHtml(html, null);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function looksLikeHtml(content: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(content);
}

import type { ParsedContent } from "./parse";
import { analyzeReadability } from "./readability";
import { category, keywordIncluded, mk } from "./checkHelpers";
import type { CheckCategory, PageType } from "./types";
import type { CheckOptions } from "./seoChecks";

const SCHEMA_BY_PAGE_TYPE: Record<PageType, string[]> = {
  program: ["Course", "EducationalOccupationalProgram"],
  admissions: ["EducationalOrganization", "CollegeOrUniversity"],
  faculty: ["Person"],
  blog: ["Article", "NewsArticle", "BlogPosting"],
  event: ["Event"],
  other: ["EducationalOrganization", "Article"],
};

export interface GeoCheckOptions extends CheckOptions {
  /** Only known when the content came from a live URL fetch; undefined for pasted content. */
  llmsTxtFound?: boolean;
}

export function runGeoChecks(parsed: ParsedContent, opts: GeoCheckOptions): CheckCategory[] {
  const kw = opts.targetKeyword?.trim() || null;

  // --- Answer-first structure ---
  const answerFirst = [];
  const leadWords = parsed.firstParagraphText.split(/\s+/).filter(Boolean).length;
  if (!parsed.firstParagraphText) {
    answerFirst.push(mk("direct-answer", "Direct answer up top", "fail", "No opening paragraph found. Lead with a 1-2 sentence direct answer to 'what is this' before any other content - that's what gets quoted by AI answer engines.", 10));
  } else if (leadWords < 10 || leadWords > 70) {
    answerFirst.push(mk("direct-answer", "Direct answer up top", "warn", `Opening paragraph is ${leadWords} words. Aim for a tight 15-50 word answer that stands alone if quoted out of context.`, 10));
  } else {
    answerFirst.push(mk("direct-answer", "Direct answer up top", "pass", `Opening paragraph is a concise ${leadWords} words - good for extraction.`, 10));
  }

  if (kw) {
    const namedUpfront = keywordIncluded(parsed.h1s[0], kw) && keywordIncluded(parsed.firstParagraphText, kw);
    answerFirst.push(
      namedUpfront
        ? mk("entity-named-upfront", "Entity named explicitly upfront", "pass", "The page names the program/topic explicitly in both the H1 and opening paragraph, rather than relying on 'we/our'.", 8)
        : mk("entity-named-upfront", "Entity named explicitly upfront", "warn", "Name the actual program/entity explicitly in the H1 and opening paragraph. AI engines quote content that's specific, not pages that say 'our program' without naming it.", 8)
    );
  }

  const hasQa = parsed.faqPairCount > 0;
  answerFirst.push(
    hasQa
      ? mk("qa-format", "Q&A formatted sections", "pass", `Found ${parsed.faqPairCount} question-style heading(s)/FAQ content - a format AI answer engines favor for direct extraction.`, 6)
      : mk("qa-format", "Q&A formatted sections", "warn", "No question-phrased headings or FAQ section. Adding common questions (e.g. 'How long does the program take?') as headings makes content easy for AI engines to lift.", 6)
  );

  answerFirst.push(
    parsed.listCount + parsed.tableCount > 0
      ? mk("lists-tables", "Lists / tables present", "pass", `Found ${parsed.listCount} list(s) and ${parsed.tableCount} table(s) - structured formats are easier for generative engines to extract and cite.`, 5)
      : mk("lists-tables", "Lists / tables present", "warn", "No lists or tables found. Breaking out requirements, dates, or comparisons into a list/table improves extractability.", 5)
  );

  // --- Entity & trust signals ---
  const trust = [];
  trust.push(
    parsed.authorSignal
      ? mk("author-signal", "Author / expertise signal", "pass", "Byline or author attribution found - supports E-E-A-T (experience, expertise, authority, trust).", 6)
      : mk("author-signal", "Author / expertise signal", "warn", "No author/byline detected. Attributing content to a named expert (faculty, admissions staff) strengthens trust signals used by both search and AI ranking.", 6)
  );

  const expectedSchemas = SCHEMA_BY_PAGE_TYPE[opts.pageType];
  const hasExpectedSchema = expectedSchemas.some((t) => parsed.jsonLdTypes.includes(t));
  trust.push(
    hasExpectedSchema
      ? mk("structured-entity", "Structured entity data", "pass", `Schema.org markup (${expectedSchemas.find((t) => parsed.jsonLdTypes.includes(t))}) gives AI crawlers a machine-readable fact sheet for this page.`, 7)
      : mk("structured-entity", "Structured entity data", "warn", `No ${expectedSchemas.join("/")} structured data. This is one of the highest-leverage GEO improvements - it lets AI systems extract facts (name, dates, credentials) without guessing.`, 7)
  );

  trust.push(
    parsed.lastUpdatedSignal
      ? mk("freshness-visible", "Visible freshness signal", "pass", "A visible 'last updated/reviewed' date or <time> element was found - generative engines weight recency.", 5)
      : mk("freshness-visible", "Visible freshness signal", "warn", "No visible last-updated/reviewed date. Especially for admissions deadlines and program details, show a clear last-reviewed date.", 5)
  );

  // --- Extractability ---
  const extract = [];
  extract.push(
    parsed.hasArticleTag || parsed.hasSectionTag
      ? mk("semantic-html", "Semantic HTML structure", "pass", "Uses <article>/<section> landmarks that help parsers segment the content correctly.", 3)
      : mk("semantic-html", "Semantic HTML structure", "warn", "No <article>/<section> tags found. Semantic HTML helps AI crawlers correctly segment and attribute content.", 3)
  );

  if (parsed.paragraphTexts.length > 0) {
    const avgParaWords =
      parsed.paragraphTexts.reduce((sum, p) => sum + p.split(/\s+/).filter(Boolean).length, 0) /
      parsed.paragraphTexts.length;
    if (avgParaWords > 150) {
      extract.push(mk("chunk-size", "Self-contained paragraph length", "warn", `Average paragraph is ~${Math.round(avgParaWords)} words - quite long. Generative engines retrieve content in chunks; shorter, focused paragraphs (roughly 30-120 words) are more likely to be extracted cleanly.`, 4));
    } else {
      extract.push(mk("chunk-size", "Self-contained paragraph length", "pass", `Average paragraph is ~${Math.round(avgParaWords)} words - a reasonable chunk size for retrieval.`, 4));
    }
  }

  const readability = analyzeReadability(parsed.bodyText);
  extract.push(
    readability.avgWordsPerSentence > 0 && readability.avgWordsPerSentence <= 22
      ? mk("sentence-length", "Concise sentence structure", "pass", `Average sentence length ≈ ${readability.avgWordsPerSentence} words - easy for AI systems to parse and summarize accurately.`, 3)
      : mk("sentence-length", "Concise sentence structure", "warn", `Average sentence length ≈ ${readability.avgWordsPerSentence} words - long sentences are more likely to be summarized inaccurately. Break them up.`, 3)
  );

  // --- Freshness & citations ---
  const citations = [];
  const statsRatio = parsed.wordCount > 0 ? (parsed.statsCount / parsed.wordCount) * 1000 : 0;
  citations.push(
    parsed.statsCount >= 3
      ? mk("quotable-facts", "Quotable, specific facts", "pass", `Found ${parsed.statsCount} concrete number(s)/stat(s) - specific facts are what generative engines prefer to quote over generic marketing language.`, 6)
      : mk("quotable-facts", "Quotable, specific facts", "warn", `Only ${parsed.statsCount} concrete number(s)/stat(s) found. Add specifics - credit hours, tuition, job placement rate, class size, deadlines - AI engines favor citable specifics over vague claims.`, 6)
  );
  void statsRatio;

  citations.push(
    parsed.externalLinkCount >= 2
      ? mk("external-citations", "Cites external sources", "pass", `Links out to ${parsed.externalLinkCount} external source(s), which builds topical trust.`, 3)
      : mk("external-citations", "Cites external sources", "warn", "Fewer than 2 outbound citations to authoritative external sources (accreditation, research, government/industry data).", 3)
  );

  if (typeof opts.llmsTxtFound === "boolean") {
    citations.push(
      opts.llmsTxtFound
        ? mk("llms-txt", "llms.txt present", "pass", "Site publishes an llms.txt file - the emerging standard AI crawlers use to find canonical, well-structured content.", 3)
        : mk("llms-txt", "llms.txt present", "warn", "No llms.txt found at the site root. This is an emerging (optional, not yet universal) convention some AI crawlers check for a curated content map - low priority but worth knowing about.", 2)
    );
  }

  return [
    category("answer-first", "Answer-First Structure", answerFirst),
    category("trust", "Entity & Trust Signals", trust),
    category("extractability", "Extractability", extract),
    category("citations", "Freshness & Citations", citations),
  ];
}

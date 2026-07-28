import type { ParsedContent } from "./parse";
import { analyzeReadability } from "./readability";
import { category, keywordIncluded, mk } from "./checkHelpers";
import type { CheckCategory, PageType } from "./types";

const WORD_COUNT_TARGETS: Record<PageType, number> = {
  program: 600,
  admissions: 400,
  faculty: 300,
  blog: 800,
  event: 250,
  other: 400,
};

const SCHEMA_BY_PAGE_TYPE: Record<PageType, string[]> = {
  program: ["Course", "EducationalOccupationalProgram"],
  admissions: ["EducationalOrganization", "CollegeOrUniversity"],
  faculty: ["Person"],
  blog: ["Article", "NewsArticle", "BlogPosting"],
  event: ["Event"],
  other: [],
};

export interface CheckOptions {
  pageType: PageType;
  targetKeyword: string | null;
}

export function runSeoChecks(parsed: ParsedContent, opts: CheckOptions): CheckCategory[] {
  const kw = opts.targetKeyword?.trim() || null;

  // --- Metadata ---
  const metadata = [];
  if (!parsed.title) {
    metadata.push(mk("title-present", "Title tag", "fail", "No <title> tag found. Add a unique, descriptive title for this page.", 10));
  } else {
    const len = parsed.title.length;
    if (len < 15 || len > 60) {
      metadata.push(mk("title-length", "Title length", "warn", `Title is ${len} characters. Aim for 15-60 so it isn't truncated in search results.`, 6));
    } else {
      metadata.push(mk("title-length", "Title length", "pass", `Title is ${len} characters - good length.`, 6));
    }
    if (kw) {
      metadata.push(
        keywordIncluded(parsed.title, kw)
          ? mk("title-keyword", "Title contains target keyword", "pass", "Target keyword found in the title.", 8)
          : mk("title-keyword", "Title contains target keyword", "warn", "Target keyword isn't in the title. Work it in naturally, ideally near the front.", 8)
      );
    }
  }

  if (!parsed.metaDescription) {
    metadata.push(mk("meta-desc-present", "Meta description", "fail", "No meta description found. Search engines will auto-generate a snippet instead of your chosen copy.", 8));
  } else {
    const len = parsed.metaDescription.length;
    if (len < 70 || len > 160) {
      metadata.push(mk("meta-desc-length", "Meta description length", "warn", `Meta description is ${len} characters. Aim for 70-160 for a clean search snippet.`, 5));
    } else {
      metadata.push(mk("meta-desc-length", "Meta description length", "pass", `Meta description is ${len} characters - good length.`, 5));
    }
    if (kw) {
      metadata.push(
        keywordIncluded(parsed.metaDescription, kw)
          ? mk("meta-desc-keyword", "Meta description contains keyword", "pass", "Target keyword found in the meta description.", 4)
          : mk("meta-desc-keyword", "Meta description contains keyword", "warn", "Target keyword isn't in the meta description.", 4)
      );
    }
  }

  metadata.push(
    parsed.canonical
      ? mk("canonical", "Canonical tag", "pass", "Canonical link tag is present.", 3)
      : mk("canonical", "Canonical tag", "warn", "No canonical tag found. Add one to avoid duplicate-content issues, especially for pages reachable via multiple URLs.", 3)
  );

  if (parsed.robotsMeta && /noindex/i.test(parsed.robotsMeta)) {
    metadata.push(mk("robots-noindex", "Indexing allowed", "fail", "This page has a robots meta tag set to noindex - it will not appear in search results.", 10));
  } else {
    metadata.push(mk("robots-noindex", "Indexing allowed", "pass", "Page is not blocked from indexing.", 10));
  }

  metadata.push(
    parsed.viewportMeta
      ? mk("viewport", "Mobile viewport tag", "pass", "Viewport meta tag present for mobile rendering.", 3)
      : mk("viewport", "Mobile viewport tag", "fail", "No viewport meta tag found - page may not render correctly on mobile, which hurts mobile search ranking.", 3)
  );

  // --- Headings & structure ---
  const headings = [];
  if (parsed.h1s.length === 0) {
    headings.push(mk("h1-present", "H1 heading", "fail", "No H1 found. Every page needs exactly one clear H1.", 8));
  } else if (parsed.h1s.length > 1) {
    headings.push(mk("h1-present", "H1 heading", "warn", `Found ${parsed.h1s.length} H1 tags. Use exactly one per page.`, 8));
  } else {
    headings.push(mk("h1-present", "H1 heading", "pass", "Exactly one H1 found.", 8));
    if (kw) {
      headings.push(
        keywordIncluded(parsed.h1s[0], kw)
          ? mk("h1-keyword", "H1 contains target keyword", "pass", "Target keyword found in the H1.", 6)
          : mk("h1-keyword", "H1 contains target keyword", "warn", "Target keyword isn't in the H1.", 6)
      );
    }
  }

  const skipped = headingHierarchySkips(parsed.headings.map((h) => h.level));
  headings.push(
    skipped
      ? mk("heading-hierarchy", "Heading hierarchy", "warn", "Heading levels skip a level (e.g. H2 straight to H4). Keep hierarchy sequential so it's easy to scan and machine-parse.", 4)
      : mk("heading-hierarchy", "Heading hierarchy", "pass", "Heading levels are in logical order.", 4)
  );

  // --- Content ---
  const content = [];
  const target = WORD_COUNT_TARGETS[opts.pageType];
  if (parsed.wordCount < target * 0.5) {
    content.push(mk("word-count", "Content depth", "fail", `Only ${parsed.wordCount} words. ${pageTypeLabel(opts.pageType)} pages typically need ~${target}+ words to cover the topic and satisfy search intent.`, 8));
  } else if (parsed.wordCount < target) {
    content.push(mk("word-count", "Content depth", "warn", `${parsed.wordCount} words - a bit thin for a ${pageTypeLabel(opts.pageType).toLowerCase()}. Consider expanding toward ~${target}+ words.`, 8));
  } else {
    content.push(mk("word-count", "Content depth", "pass", `${parsed.wordCount} words - solid depth for this page type.`, 8));
  }

  if (kw) {
    const first100 = parsed.bodyText.split(/\s+/).slice(0, 100).join(" ");
    content.push(
      keywordIncluded(first100, kw)
        ? mk("keyword-intro", "Keyword in opening content", "pass", "Target keyword appears within the first ~100 words.", 5)
        : mk("keyword-intro", "Keyword in opening content", "warn", "Target keyword doesn't appear in the first ~100 words. Lead with what the page is about.", 5)
    );

    const density = keywordDensity(parsed.bodyText, kw);
    if (density === 0) {
      content.push(mk("keyword-density", "Keyword usage", "fail", "Target keyword doesn't appear in the body content at all.", 5));
    } else if (density > 3) {
      content.push(mk("keyword-density", "Keyword usage", "warn", `Keyword density is ${density.toFixed(1)}% - that's keyword stuffing territory. Write for readers, not repetition.`, 5));
    } else {
      content.push(mk("keyword-density", "Keyword usage", "pass", `Keyword density is ${density.toFixed(1)}% - natural usage.`, 5));
    }
  }

  const readability = analyzeReadability(parsed.bodyText);
  if (readability.fleschScore >= 50) {
    content.push(mk("readability", "Readability", "pass", `Flesch Reading Ease ≈ ${readability.fleschScore} - accessible to a general audience.`, 4));
  } else if (readability.fleschScore >= 30) {
    content.push(mk("readability", "Readability", "warn", `Flesch Reading Ease ≈ ${readability.fleschScore} - fairly dense. Shorter sentences will help both readers and AI summarizers.`, 4));
  } else {
    content.push(mk("readability", "Readability", "fail", `Flesch Reading Ease ≈ ${readability.fleschScore} - very dense/academic phrasing. Simplify sentence structure.`, 4));
  }

  // --- Links & images ---
  const links = [];
  if (parsed.images.length > 0) {
    const missingAlt = parsed.images.filter((img) => !img.alt || !img.alt.trim()).length;
    if (missingAlt === 0) {
      links.push(mk("image-alt", "Image alt text", "pass", `All ${parsed.images.length} image(s) have alt text.`, 5));
    } else {
      links.push(mk("image-alt", "Image alt text", missingAlt === parsed.images.length ? "fail" : "warn", `${missingAlt} of ${parsed.images.length} image(s) are missing alt text.`, 5));
    }
  }

  links.push(
    parsed.internalLinkCount >= 2
      ? mk("internal-links", "Internal linking", "pass", `${parsed.internalLinkCount} internal link(s) - helps search engines and AI crawlers discover related pages.`, 4)
      : mk("internal-links", "Internal linking", "warn", `Only ${parsed.internalLinkCount} internal link(s). Link to related programs, faculty, or resources.`, 4)
  );

  links.push(
    parsed.externalLinkCount > 0
      ? mk("external-links", "Authoritative outbound links", "pass", `${parsed.externalLinkCount} outbound link(s) to external sources.`, 2)
      : mk("external-links", "Authoritative outbound links", "warn", "No outbound links to authoritative sources (accreditation bodies, research partners, government data, etc).", 2)
  );

  // --- Technical / structured data ---
  const technical = [];
  const expectedSchemas = SCHEMA_BY_PAGE_TYPE[opts.pageType];
  if (expectedSchemas.length === 0) {
    technical.push(
      parsed.jsonLdTypes.length > 0
        ? mk("schema-present", "Structured data (schema.org)", "pass", `Found schema types: ${parsed.jsonLdTypes.join(", ")}.`, 5)
        : mk("schema-present", "Structured data (schema.org)", "warn", "No JSON-LD structured data found. Structured data helps both search engines and AI systems understand the page.", 5)
    );
  } else {
    const hasExpected = expectedSchemas.some((t) => parsed.jsonLdTypes.includes(t));
    technical.push(
      hasExpected
        ? mk("schema-present", "Structured data (schema.org)", "pass", `Found expected schema type for a ${pageTypeLabel(opts.pageType).toLowerCase()} (${expectedSchemas.find((t) => parsed.jsonLdTypes.includes(t))}).`, 7)
        : mk("schema-present", "Structured data (schema.org)", "warn", `No ${expectedSchemas.join(" or ")} schema found. Adding it helps this ${pageTypeLabel(opts.pageType).toLowerCase()} show up in rich results and be understood by AI crawlers.`, 7)
    );
  }

  return [
    category("metadata", "Metadata", metadata),
    category("headings", "Headings & Structure", headings),
    category("content", "Content", content),
    category("links", "Links & Images", links),
    category("technical", "Technical / Structured Data", technical),
  ];
}

function headingHierarchySkips(levels: number[]): boolean {
  let prev = 0;
  for (const level of levels) {
    if (prev !== 0 && level - prev > 1) return true;
    prev = level;
  }
  return false;
}

function keywordDensity(text: string, keyword: string): number {
  const words = text.toLowerCase().match(/[a-z0-9'-]+/g) ?? [];
  if (words.length === 0) return 0;
  const kwWords = keyword.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (kwWords.length === 0) return 0;
  let occurrences = 0;
  for (let i = 0; i <= words.length - kwWords.length; i++) {
    let match = true;
    for (let j = 0; j < kwWords.length; j++) {
      if (words[i + j] !== kwWords[j]) {
        match = false;
        break;
      }
    }
    if (match) occurrences++;
  }
  return (occurrences / words.length) * 100;
}

function pageTypeLabel(t: PageType): string {
  switch (t) {
    case "program":
      return "Program/degree";
    case "admissions":
      return "Admissions/landing";
    case "faculty":
      return "Faculty profile";
    case "blog":
      return "Blog/news";
    case "event":
      return "Event";
    default:
      return "Content";
  }
}

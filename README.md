# Uni SEO+GEO Tracker

A local tool for university content/marketing teams to plan, track, and optimize
content for both **SEO** (traditional search) and **GEO** (Generative Engine
Optimization — how well content gets surfaced/cited by ChatGPT, Perplexity, Google
AI Overviews, etc). It's built for two workflows:

- **Content planning**: an inventory of program, admissions, faculty, and blog pages
  with a status pipeline, ownership, target dates, and a pillar/cluster topic model.
- **Daily creation & optimization**: a checker that scores a live URL or a pasted
  draft against a rule-based SEO + GEO checklist, with specific, actionable fixes.

Everything runs locally: a Next.js app with a SQLite file for storage. No accounts,
no external SEO/keyword-volume APIs, no data leaves your machine except when you
explicitly ask it to fetch a URL you give it.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Data is stored in `data/seo-geo.db`
(SQLite, created automatically, gitignored) — back that file up or move it to migrate
your data.

```bash
npm run build && npm start   # production mode
```

## How it's organized

- **Dashboard** (`/`) — portfolio view: tracked page count, average SEO/GEO scores,
  pipeline funnel by status, and which published pages haven't been re-checked in a
  while (staleness hurts both classic SEO and GEO, which rewards freshness).
- **Content Planning** (`/plan`) — the page inventory. Add pages you're planning or
  have published, group them into **clusters** (a pillar topic with related pages —
  the pillar/cluster content model), set status (idea → researching → drafting → in
  review → published → needs update), owner, and target publish date. Table and
  calendar views.
- **Checker** (`/checker`) — paste a draft (HTML, markdown, or plain text) or point it
  at a live URL, pick a page type and target keyword, and get separate SEO and GEO
  scores (0–100) with a categorized, actionable checklist. Optionally attach the run
  to a tracked page to save it to that page's score history (shown on the dashboard
  and in the planning table).

## Methodology

Every check is deterministic and rule-based — no external API keys or paid SEO tools
required. Checks are grouped by category and weighted; a check can `pass`, `warn`, or
`fail`, and the score is a weighted percentage. Some checks are page-type aware (a
program/degree page, admissions page, faculty profile, blog post, and event page have
different expectations for content depth and structured-data type).

### SEO (traditional search)

| Category | What's checked |
|---|---|
| Metadata | Title presence/length/keyword, meta description presence/length/keyword, canonical tag, `noindex` guard, mobile viewport tag |
| Headings & Structure | Exactly one H1 (with keyword), logical heading hierarchy (no skipped levels) |
| Content | Word count vs. a page-type target, keyword in the opening ~100 words, keyword density (flags stuffing), Flesch readability |
| Links & Images | Image alt-text coverage, internal link count, outbound links to authoritative sources |
| Technical / Structured Data | schema.org JSON-LD presence, matched to the expected type for the page type (`Course`/`EducationalOccupationalProgram` for programs, `Person` for faculty, `Article`/`BlogPosting` for blog, etc.) |

### GEO (generative engine optimization)

Generative/answer engines don't rank pages the way search engines do — they retrieve
and synthesize chunks of content, so they reward different signals: extractable,
self-contained, specific, well-attributed, structured content.

| Category | What's checked |
|---|---|
| Answer-First Structure | A concise, self-contained opening paragraph (inverted pyramid); the entity/program named explicitly (not just "our program") in the H1 + opening; question-phrased headings / FAQ-style sections; presence of lists/tables |
| Entity & Trust Signals | Author/byline attribution (E-E-A-T), structured entity data (schema.org), a visible last-updated/reviewed date |
| Extractability | Semantic HTML (`<article>`/`<section>`), paragraph length suited to chunk-based retrieval (~30–120 words), concise sentence structure |
| Freshness & Citations | Density of concrete, quotable facts (numbers, rates, dates) vs. vague marketing language, outbound citations to authoritative sources, and (for live URLs) whether the site publishes an `llms.txt` — an emerging, optional convention some AI crawlers check for a curated content map |

### Where the code lives

- `lib/parse.ts` — turns fetched or pasted HTML (or plain text/markdown, wrapped into
  a minimal document) into a structured `ParsedContent` model shared by both engines.
- `lib/fetchPage.ts` — fetches a live URL (with a timeout and basic SSRF guards
  against local/private-network addresses) and checks for `llms.txt`.
- `lib/seoChecks.ts` / `lib/geoChecks.ts` — the rule engines; each check is a small,
  independent function returning a `pass`/`warn`/`fail` + message.
- `lib/checkHelpers.ts` — shared check-building helpers and weighted aggregation into a 0–100 score.
- `lib/analyze.ts` — the entry point that ties fetch/parse/score together for both the
  URL and paste paths.

## Notes & limitations

- No keyword-volume/backlink data — this isn't a replacement for tools like Google
  Search Console, Ahrefs, or SEMrush for discovering *what* to target; it's for
  planning and checking the content once you know your target keyword/topic.
- Live URL fetching is meant for trusted, public university pages. It refuses
  non-http(s) URLs and obvious local/private-network hosts, but if you deploy this
  somewhere network-reachable by untrusted users, put it behind auth.
- GEO is an evolving discipline without a formal standard (unlike SEO's decades of
  documented signals) — the checks here reflect current, widely-discussed best
  practices (structured data, direct answers, extractable formatting, E-E-A-T,
  freshness, citations) rather than a guaranteed ranking factor list from any one AI
  vendor.

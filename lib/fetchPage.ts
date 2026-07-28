import { parseHtml, type ParsedContent } from "./parse";

const FETCH_TIMEOUT_MS = 10_000;

const BLOCKED_HOSTNAME_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^::1$/,
  /^169\.254\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
];

export class FetchPageError extends Error {}

function assertFetchableUrl(raw: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new FetchPageError("That doesn't look like a valid URL.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new FetchPageError("Only http:// and https:// URLs are supported.");
  }
  if (BLOCKED_HOSTNAME_PATTERNS.some((re) => re.test(parsed.hostname))) {
    throw new FetchPageError("Local/private network URLs can't be fetched.");
  }
  return parsed;
}

async function timedFetch(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; UniversitySEOGeoChecker/1.0)",
        ...(init?.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

export interface FetchedPage {
  parsed: ParsedContent;
  finalUrl: string;
  llmsTxtFound: boolean;
}

export async function fetchAndParseUrl(rawUrl: string): Promise<FetchedPage> {
  const target = assertFetchableUrl(rawUrl);

  let res: Response;
  try {
    res = await timedFetch(target.toString());
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new FetchPageError("Timed out fetching that URL.");
    }
    throw new FetchPageError(`Couldn't fetch that URL: ${(err as Error).message}`);
  }

  if (!res.ok) {
    throw new FetchPageError(`Server responded ${res.status} ${res.statusText} for that URL.`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("html") && !contentType.includes("text")) {
    throw new FetchPageError(`That URL returned "${contentType || "unknown"}", not an HTML page.`);
  }

  const html = await res.text();
  const finalUrl = res.url || target.toString();
  const parsed = parseHtml(html, finalUrl);

  let llmsTxtFound = false;
  try {
    const llmsUrl = new URL("/llms.txt", finalUrl).toString();
    const llmsRes = await timedFetch(llmsUrl, { method: "GET" });
    llmsTxtFound = llmsRes.ok;
  } catch {
    llmsTxtFound = false;
  }

  return { parsed, finalUrl, llmsTxtFound };
}

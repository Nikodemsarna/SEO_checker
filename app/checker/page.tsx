"use client";

import { useEffect, useState } from "react";
import { PAGE_TYPE_LABELS, PAGE_TYPES } from "@/lib/types";
import type { AnalysisResults, PageType, SiteScanSummary, TrackedPage } from "@/lib/types";
import { ScoreBadge } from "@/components/ScoreBadge";
import { ChecklistGroup } from "@/components/ChecklistGroup";
import { SiteScanResults } from "@/components/SiteScanResults";

type Source = "url" | "paste" | "domain";

export default function CheckerPage() {
  const [source, setSource] = useState<Source>("url");
  const [url, setUrl] = useState("");
  const [content, setContent] = useState("");
  const [maxPages, setMaxPages] = useState("15");
  const [pageType, setPageType] = useState<PageType>("program");
  const [targetKeyword, setTargetKeyword] = useState("");
  const [pageId, setPageId] = useState<string>("");
  const [pages, setPages] = useState<TrackedPage[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<AnalysisResults | null>(null);
  const [scanSummary, setScanSummary] = useState<SiteScanSummary | null>(null);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<"seo" | "geo">("seo");

  useEffect(() => {
    fetch("/api/pages")
      .then((r) => r.json())
      .then((d) => {
        const list: TrackedPage[] = d.pages ?? [];
        setPages(list);
        const preselect = new URLSearchParams(window.location.search).get("pageId");
        if (preselect && list.some((p) => String(p.id) === preselect)) {
          setPageId(preselect);
          const page = list.find((p) => String(p.id) === preselect);
          if (page) {
            if (page.url) {
              setUrl(page.url);
              setSource("url");
            }
            setPageType(page.page_type);
            setTargetKeyword(page.target_keyword ?? "");
          }
        }
      })
      .catch(() => {});
  }, []);

  function applyTrackedPage(id: string) {
    setPageId(id);
    const page = pages.find((p) => String(p.id) === id);
    if (page) {
      if (page.url) {
        setUrl(page.url);
        setSource("url");
      }
      setPageType(page.page_type);
      setTargetKeyword(page.target_keyword ?? "");
    }
  }

  async function runCheck(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResults(null);
    setScanSummary(null);
    setSaved(false);

    if (source === "domain") {
      try {
        const res = await fetch("/api/site-scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url,
            pageType,
            maxPages: Number(maxPages) || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Something went wrong.");
          return;
        }
        setScanSummary(data.summary);
      } catch {
        setError("Network error - is the app running?");
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          url,
          content,
          pageType,
          targetKeyword,
          pageId: pageId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setResults(data.results);
      setSaved(!!data.auditId);
    } catch {
      setError("Network error - is the app running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Page Checker</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Check a live page or a draft against SEO and GEO (generative engine optimization) best practices before or after publishing.
        </p>
      </div>

      <form onSubmit={runCheck} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-4">
        <div className="flex gap-2 text-sm">
          <button
            type="button"
            onClick={() => setSource("url")}
            className={`px-3 py-1.5 rounded-md border ${source === "url" ? "bg-indigo-600 text-white border-indigo-600" : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300"}`}
          >
            Live URL
          </button>
          <button
            type="button"
            onClick={() => setSource("paste")}
            className={`px-3 py-1.5 rounded-md border ${source === "paste" ? "bg-indigo-600 text-white border-indigo-600" : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300"}`}
          >
            Paste draft (HTML / text / markdown)
          </button>
          <button
            type="button"
            onClick={() => setSource("domain")}
            className={`px-3 py-1.5 rounded-md border ${source === "domain" ? "bg-indigo-600 text-white border-indigo-600" : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300"}`}
          >
            Scan whole domain
          </button>
        </div>

        {source === "paste" ? (
          <textarea
            required
            rows={8}
            placeholder="Paste page HTML, markdown, or plain draft text..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm font-mono"
          />
        ) : (
          <input
            type="url"
            required
            placeholder={
              source === "domain"
                ? "https://www.university.edu"
                : "https://www.university.edu/programs/computer-science"
            }
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm"
          />
        )}

        {source === "domain" ? (
          <p className="text-xs text-slate-400">
            Discovers pages via the site&apos;s sitemap.xml, falling back to crawling internal links from the URL above if no sitemap is found.
          </p>
        ) : null}

        <div className="grid sm:grid-cols-3 gap-3">
          <label className="text-sm">
            <span className="block text-slate-500 dark:text-slate-400 mb-1">Page type</span>
            <select
              value={pageType}
              onChange={(e) => setPageType(e.target.value as PageType)}
              className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1.5"
            >
              {PAGE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {PAGE_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          {source === "domain" ? (
            <label className="text-sm">
              <span className="block text-slate-500 dark:text-slate-400 mb-1">Max pages to scan</span>
              <input
                type="number"
                min={1}
                max={40}
                value={maxPages}
                onChange={(e) => setMaxPages(e.target.value)}
                className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1.5"
              />
            </label>
          ) : (
            <>
              <label className="text-sm">
                <span className="block text-slate-500 dark:text-slate-400 mb-1">Target keyword</span>
                <input
                  type="text"
                  placeholder="e.g. mba program"
                  value={targetKeyword}
                  onChange={(e) => setTargetKeyword(e.target.value)}
                  className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1.5"
                />
              </label>
              <label className="text-sm">
                <span className="block text-slate-500 dark:text-slate-400 mb-1">Attach to tracked page (optional)</span>
                <select
                  value={pageId}
                  onChange={(e) => applyTrackedPage(e.target.value)}
                  className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1.5"
                >
                  <option value="">Ad-hoc (don&apos;t save)</option>
                  {pages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-medium px-4 py-2"
        >
          {loading ? (source === "domain" ? "Scanning…" : "Analyzing…") : "Run check"}
        </button>
        {error && <p className="text-sm text-rose-600">{error}</p>}
      </form>

      {scanSummary && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <SiteScanResults summary={scanSummary} />
        </div>
      )}

      {results && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-5">
          <div className="flex flex-wrap items-center gap-6">
            <ScoreBadge label="SEO score" score={results.seoScore} size="lg" />
            <ScoreBadge label="GEO score" score={results.geoScore} size="lg" />
            <div className="text-sm text-slate-500 dark:text-slate-400">
              <div>{results.meta.wordCount} words analyzed</div>
              {results.meta.fetchedUrl && <div className="truncate max-w-xs">{results.meta.fetchedUrl}</div>}
              {saved && <div className="text-emerald-600 dark:text-emerald-400 mt-1">Saved to tracked page&apos;s history.</div>}
            </div>
          </div>

          <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800 text-sm">
            <button
              onClick={() => setTab("seo")}
              className={`px-3 py-2 -mb-px border-b-2 ${tab === "seo" ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 font-medium" : "border-transparent text-slate-500"}`}
            >
              SEO checklist
            </button>
            <button
              onClick={() => setTab("geo")}
              className={`px-3 py-2 -mb-px border-b-2 ${tab === "geo" ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 font-medium" : "border-transparent text-slate-500"}`}
            >
              GEO checklist
            </button>
          </div>

          <ChecklistGroup categories={tab === "seo" ? results.seoCategories : results.geoCategories} />
        </div>
      )}
    </div>
  );
}

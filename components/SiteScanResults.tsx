"use client";

import { useState } from "react";
import type { SiteScanSummary } from "@/lib/types";
import { ScoreBadge, ScoreInline } from "./ScoreBadge";
import { ChecklistGroup } from "./ChecklistGroup";

export function SiteScanResults({ summary }: { summary: SiteScanSummary }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-6">
        <ScoreBadge label="Avg SEO score" score={summary.avgSeoScore ?? 0} size="lg" />
        <ScoreBadge label="Avg GEO score" score={summary.avgGeoScore ?? 0} size="lg" />
        <div className="text-sm text-slate-500 dark:text-slate-400">
          <div>
            {summary.pagesScanned} page{summary.pagesScanned === 1 ? "" : "s"} scanned via{" "}
            {summary.discoveryMethod === "sitemap" ? "sitemap.xml" : "link crawl"}
          </div>
          <div className="truncate max-w-xs">{summary.origin}</div>
          {summary.truncated && (
            <div className="text-amber-600 dark:text-amber-400 mt-1">
              More pages were found than the limit — raise max pages to cover more of the site.
            </div>
          )}
        </div>
      </div>

      {summary.topIssues.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Most common site-wide issues</h3>
          <ul className="space-y-1.5">
            {summary.topIssues.map((issue) => (
              <li
                key={`${issue.category}:${issue.id}`}
                className="flex items-center justify-between gap-3 text-sm rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2"
              >
                <span className="text-slate-700 dark:text-slate-200 min-w-0 truncate">
                  <span className="uppercase text-xs text-slate-400 mr-2">{issue.category}</span>
                  {issue.label}
                </span>
                <span className="text-slate-500 dark:text-slate-400 text-xs shrink-0">
                  {issue.pagesAffected} page{issue.pagesAffected === 1 ? "" : "s"} affected
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Pages</h3>
        <div className="space-y-2">
          {summary.pages.map((page) => {
            const isOpen = expanded === page.url;
            return (
              <div key={page.url} className="rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : page.url)}
                  disabled={!!page.error}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-sm disabled:cursor-default"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-slate-800 dark:text-slate-100 truncate">{page.title ?? page.url}</div>
                    <div className="text-xs text-slate-400 truncate">{page.url}</div>
                  </div>
                  {page.error ? (
                    <span className="text-xs text-rose-600 dark:text-rose-400 shrink-0 max-w-[12rem] truncate">{page.error}</span>
                  ) : (
                    <div className="flex gap-1.5 shrink-0">
                      <ScoreInline label="SEO" score={page.seoScore} />
                      <ScoreInline label="GEO" score={page.geoScore} />
                    </div>
                  )}
                </button>
                {isOpen && page.seoCategories && page.geoCategories && (
                  <div className="border-t border-slate-200 dark:border-slate-800 p-3 space-y-5">
                    <ChecklistGroup categories={page.seoCategories} />
                    <ChecklistGroup categories={page.geoCategories} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

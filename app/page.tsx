import Link from "next/link";
import { getDb } from "@/lib/db";
import { PAGE_STATUS_LABELS, PAGE_STATUSES } from "@/lib/types";
import type { PageStatus, TrackedPage } from "@/lib/types";
import { ScoreInline } from "@/components/ScoreBadge";

export const dynamic = "force-dynamic";

function loadDashboardData() {
  const db = getDb();

  const pages = db
    .prepare(
      `SELECT
         p.*,
         c.name as cluster_name,
         la.seo_score as latest_seo_score,
         la.geo_score as latest_geo_score,
         la.created_at as latest_audit_at
       FROM pages p
       LEFT JOIN clusters c ON c.id = p.cluster_id
       LEFT JOIN (
         SELECT a.* FROM audits a
         INNER JOIN (
           SELECT page_id, MAX(created_at) as max_created_at
           FROM audits WHERE page_id IS NOT NULL
           GROUP BY page_id
         ) latest ON latest.page_id = a.page_id AND latest.max_created_at = a.created_at
       ) la ON la.page_id = p.id
       ORDER BY p.updated_at DESC`
    )
    .all() as TrackedPage[];

  const clusterCount = (db.prepare(`SELECT COUNT(*) as n FROM clusters`).get() as { n: number }).n;

  return { pages, clusterCount };
}

function monthsSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const then = new Date(dateStr.replace(" ", "T") + "Z");
  if (Number.isNaN(then.getTime())) return null;
  const diffMs = Date.now() - then.getTime();
  return diffMs / (1000 * 60 * 60 * 24 * 30);
}

export default function DashboardPage() {
  const { pages, clusterCount } = loadDashboardData();

  const scored = pages.filter((p) => p.latest_seo_score !== null && p.latest_seo_score !== undefined);
  const avgSeo = scored.length
    ? Math.round(scored.reduce((s, p) => s + (p.latest_seo_score ?? 0), 0) / scored.length)
    : null;
  const avgGeo = scored.length
    ? Math.round(scored.reduce((s, p) => s + (p.latest_geo_score ?? 0), 0) / scored.length)
    : null;

  const statusCounts = PAGE_STATUSES.reduce<Record<PageStatus, number>>((acc, s) => {
    acc[s] = pages.filter((p) => p.status === s).length;
    return acc;
  }, {} as Record<PageStatus, number>);

  const stale = pages
    .filter((p) => p.status === "published")
    .map((p) => ({ page: p, months: monthsSince(p.latest_audit_at) }))
    .filter((x) => x.months === null || x.months > 4)
    .sort((a, b) => (b.months ?? 999) - (a.months ?? 999))
    .slice(0, 6);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Dashboard</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Portfolio-level view of your university&apos;s content: how it&apos;s scoring on SEO and GEO, and what needs attention.
        </p>
      </div>

      <div className="grid sm:grid-cols-4 gap-4">
        <StatCard label="Tracked pages" value={String(pages.length)} />
        <StatCard label="Clusters" value={String(clusterCount)} />
        <StatCard label="Avg SEO score" value={avgSeo === null ? "—" : String(avgSeo)} />
        <StatCard label="Avg GEO score" value={avgGeo === null ? "—" : String(avgGeo)} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Pipeline by status</h2>
          <ul className="space-y-2">
            {PAGE_STATUSES.map((s) => (
              <li key={s} className="flex items-center gap-3 text-sm">
                <span className="w-28 text-slate-500 dark:text-slate-400">{PAGE_STATUS_LABELS[s]}</span>
                <div className="flex-1 h-2 rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-indigo-500"
                    style={{ width: pages.length ? `${(statusCounts[s] / pages.length) * 100}%` : "0%" }}
                  />
                </div>
                <span className="w-6 text-right text-slate-600 dark:text-slate-300">{statusCounts[s]}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
            Needs a fresh look <span className="font-normal text-slate-400">(published, unaudited or 4+ months since last check)</span>
          </h2>
          {stale.length === 0 ? (
            <p className="text-sm text-slate-400">Nothing stale — nice.</p>
          ) : (
            <ul className="space-y-2">
              {stale.map(({ page, months }) => (
                <li key={page.id} className="flex items-center justify-between text-sm border-b border-slate-100 dark:border-slate-800/60 pb-2 last:border-0 last:pb-0">
                  <div>
                    <div className="font-medium text-slate-800 dark:text-slate-100">{page.title}</div>
                    <div className="text-xs text-slate-400">
                      {months === null ? "Never audited" : `Last audited ~${Math.round(months)} month(s) ago`}
                    </div>
                  </div>
                  <Link href={`/checker?pageId=${page.id}`} className="text-xs text-indigo-500 hover:underline shrink-0 ml-3">
                    Re-check →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Recently updated pages</h2>
          <Link href="/plan" className="text-xs text-indigo-500 hover:underline">
            View all →
          </Link>
        </div>
        {pages.length === 0 ? (
          <p className="text-sm text-slate-400">
            No pages tracked yet.{" "}
            <Link href="/plan" className="text-indigo-500 hover:underline">
              Add your first page in Content Planning
            </Link>
            .
          </p>
        ) : (
          <ul className="space-y-2">
            {pages.slice(0, 8).map((p) => (
              <li key={p.id} className="flex items-center justify-between text-sm border-b border-slate-100 dark:border-slate-800/60 pb-2 last:border-0 last:pb-0">
                <span className="font-medium text-slate-800 dark:text-slate-100">{p.title}</span>
                <div className="flex gap-1.5">
                  <ScoreInline label="SEO" score={p.latest_seo_score} />
                  <ScoreInline label="GEO" score={p.latest_geo_score} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <div className="text-2xl font-semibold text-slate-900 dark:text-white">{value}</div>
      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{label}</div>
    </div>
  );
}

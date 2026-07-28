"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  PAGE_STATUSES,
  PAGE_STATUS_LABELS,
  PAGE_TYPES,
  PAGE_TYPE_LABELS,
} from "@/lib/types";
import type { Cluster, PageStatus, PageType, TrackedPage } from "@/lib/types";
import { ScoreInline } from "@/components/ScoreBadge";

type FormState = {
  id: number | null;
  title: string;
  url: string;
  page_type: PageType;
  target_keyword: string;
  cluster_id: string;
  status: PageStatus;
  owner: string;
  target_publish_date: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  id: null,
  title: "",
  url: "",
  page_type: "program",
  target_keyword: "",
  cluster_id: "",
  status: "idea",
  owner: "",
  target_publish_date: "",
  notes: "",
};

export default function PlanPage() {
  const [pages, setPages] = useState<TrackedPage[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [view, setView] = useState<"table" | "calendar">("table");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [clusterFilter, setClusterFilter] = useState<string>("");
  const [form, setForm] = useState<FormState | null>(null);
  const [newClusterName, setNewClusterName] = useState("");
  const [loading, setLoading] = useState(true);

  async function reload() {
    const [pagesRes, clustersRes] = await Promise.all([
      fetch("/api/pages").then((r) => r.json()),
      fetch("/api/clusters").then((r) => r.json()),
    ]);
    setPages(pagesRes.pages ?? []);
    setClusters(clustersRes.clusters ?? []);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial client-side data load, not a render-cascade
    reload();
  }, []);

  const filtered = useMemo(() => {
    return pages.filter((p) => {
      if (statusFilter && p.status !== statusFilter) return false;
      if (clusterFilter && String(p.cluster_id) !== clusterFilter) return false;
      return true;
    });
  }, [pages, statusFilter, clusterFilter]);

  async function saveForm(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    const payload = {
      title: form.title,
      url: form.url || null,
      page_type: form.page_type,
      target_keyword: form.target_keyword || null,
      cluster_id: form.cluster_id ? Number(form.cluster_id) : null,
      status: form.status,
      owner: form.owner || null,
      target_publish_date: form.target_publish_date || null,
      notes: form.notes || null,
    };
    if (form.id) {
      await fetch(`/api/pages/${form.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    setForm(null);
    reload();
  }

  async function deletePage(id: number) {
    if (!confirm("Delete this tracked page? This also removes its audit history.")) return;
    await fetch(`/api/pages/${id}`, { method: "DELETE" });
    reload();
  }

  async function addCluster(e: React.FormEvent) {
    e.preventDefault();
    if (!newClusterName.trim()) return;
    await fetch("/api/clusters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newClusterName.trim() }),
    });
    setNewClusterName("");
    reload();
  }

  function editPage(p: TrackedPage) {
    setForm({
      id: p.id,
      title: p.title,
      url: p.url ?? "",
      page_type: p.page_type,
      target_keyword: p.target_keyword ?? "",
      cluster_id: p.cluster_id ? String(p.cluster_id) : "",
      status: p.status,
      owner: p.owner ?? "",
      target_publish_date: p.target_publish_date ?? "",
      notes: p.notes ?? "",
    });
  }

  const calendarGroups = useMemo(() => {
    const withDate = filtered.filter((p) => p.target_publish_date);
    const groups = new Map<string, TrackedPage[]>();
    for (const p of withDate) {
      const month = (p.target_publish_date ?? "").slice(0, 7) || "No date";
      if (!groups.has(month)) groups.set(month, []);
      groups.get(month)!.push(p);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Content Planning</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Inventory of program, admissions, faculty, and blog pages using a pillar/cluster model — plan what to write, track status, and see the latest audit scores at a glance.
          </p>
        </div>
        <button
          onClick={() => setForm(EMPTY_FORM)}
          className="rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2"
        >
          + Add page
        </button>
      </div>

      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Clusters (pillar topics)</h2>
        <div className="flex flex-wrap gap-2 mb-3">
          {clusters.map((c) => (
            <span key={c.id} className="text-xs rounded-full px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {c.name}
            </span>
          ))}
          {clusters.length === 0 && <span className="text-xs text-slate-400">No clusters yet.</span>}
        </div>
        <form onSubmit={addCluster} className="flex gap-2">
          <input
            value={newClusterName}
            onChange={(e) => setNewClusterName(e.target.value)}
            placeholder="New cluster / pillar topic, e.g. Graduate Business Programs"
            className="flex-1 rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1.5 text-sm"
          />
          <button type="submit" className="rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm">
            Add cluster
          </button>
        </form>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 text-sm">
          <button
            onClick={() => setView("table")}
            className={`px-3 py-1.5 rounded-md border ${view === "table" ? "bg-indigo-600 text-white border-indigo-600" : "border-slate-300 dark:border-slate-700"}`}
          >
            Table
          </button>
          <button
            onClick={() => setView("calendar")}
            className={`px-3 py-1.5 rounded-md border ${view === "calendar" ? "bg-indigo-600 text-white border-indigo-600" : "border-slate-300 dark:border-slate-700"}`}
          >
            Calendar
          </button>
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1.5">
          <option value="">All statuses</option>
          {PAGE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {PAGE_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select value={clusterFilter} onChange={(e) => setClusterFilter(e.target.value)} className="text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1.5">
          <option value="">All clusters</option>
          {clusters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : view === "table" ? (
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <th className="px-3 py-2 font-medium">Title</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Cluster</th>
                <th className="px-3 py-2 font-medium">Owner</th>
                <th className="px-3 py-2 font-medium">Target date</th>
                <th className="px-3 py-2 font-medium">Scores</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800/60 last:border-0">
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-800 dark:text-slate-100">{p.title}</div>
                    {p.url && (
                      <a href={p.url} target="_blank" rel="noreferrer" className="text-xs text-indigo-500 hover:underline">
                        {p.url}
                      </a>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{PAGE_TYPE_LABELS[p.page_type]}</td>
                  <td className="px-3 py-2">
                    <StatusPill status={p.status} />
                  </td>
                  <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{p.cluster_name ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{p.owner ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{p.target_publish_date ?? "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <ScoreInline label="SEO" score={p.latest_seo_score} />
                      <ScoreInline label="GEO" score={p.latest_geo_score} />
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <Link href={`/checker?pageId=${p.id}`} className="text-xs text-indigo-500 hover:underline mr-3">
                      Check
                    </Link>
                    <button onClick={() => editPage(p)} className="text-xs text-slate-500 hover:underline mr-3">
                      Edit
                    </button>
                    <button onClick={() => deletePage(p.id)} className="text-xs text-rose-500 hover:underline">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-slate-400">
                    No pages tracked yet. Click &ldquo;Add page&rdquo; to start planning content.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-4">
          {calendarGroups.length === 0 && (
            <p className="text-sm text-slate-400">No pages have a target publish date yet.</p>
          )}
          {calendarGroups.map(([month, items]) => (
            <div key={month} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">{formatMonth(month)}</h3>
              <ul className="space-y-2">
                {items
                  .sort((a, b) => (a.target_publish_date ?? "").localeCompare(b.target_publish_date ?? ""))
                  .map((p) => (
                    <li key={p.id} className="flex items-center justify-between text-sm border-b border-slate-100 dark:border-slate-800/60 pb-2 last:border-0 last:pb-0">
                      <div>
                        <span className="text-slate-400 mr-2">{p.target_publish_date}</span>
                        <span className="font-medium text-slate-800 dark:text-slate-100">{p.title}</span>
                        <span className="text-slate-400 ml-2">({PAGE_TYPE_LABELS[p.page_type]})</span>
                      </div>
                      <StatusPill status={p.status} />
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {form && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setForm(null)}>
          <div
            className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-5 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-slate-900 dark:text-white mb-3">{form.id ? "Edit page" : "Add page"}</h3>
            <form onSubmit={saveForm} className="space-y-3 text-sm">
              <label className="block">
                <span className="block text-slate-500 dark:text-slate-400 mb-1">Title *</span>
                <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1.5" />
              </label>
              <label className="block">
                <span className="block text-slate-500 dark:text-slate-400 mb-1">URL (once published)</span>
                <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1.5" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-slate-500 dark:text-slate-400 mb-1">Page type</span>
                  <select value={form.page_type} onChange={(e) => setForm({ ...form, page_type: e.target.value as PageType })} className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1.5">
                    {PAGE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {PAGE_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="block text-slate-500 dark:text-slate-400 mb-1">Status</span>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as PageStatus })} className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1.5">
                    {PAGE_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {PAGE_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="block text-slate-500 dark:text-slate-400 mb-1">Target keyword</span>
                <input value={form.target_keyword} onChange={(e) => setForm({ ...form, target_keyword: e.target.value })} className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1.5" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-slate-500 dark:text-slate-400 mb-1">Cluster</span>
                  <select value={form.cluster_id} onChange={(e) => setForm({ ...form, cluster_id: e.target.value })} className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1.5">
                    <option value="">None</option>
                    {clusters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="block text-slate-500 dark:text-slate-400 mb-1">Owner</span>
                  <input value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1.5" />
                </label>
              </div>
              <label className="block">
                <span className="block text-slate-500 dark:text-slate-400 mb-1">Target publish date</span>
                <input type="date" value={form.target_publish_date} onChange={(e) => setForm({ ...form, target_publish_date: e.target.value })} className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1.5" />
              </label>
              <label className="block">
                <span className="block text-slate-500 dark:text-slate-400 mb-1">Notes</span>
                <textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1.5" />
              </label>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setForm(null)} className="px-3 py-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-700">
                  Cancel
                </button>
                <button type="submit" className="px-3 py-1.5 text-sm rounded-md bg-indigo-600 hover:bg-indigo-500 text-white">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: PageStatus }) {
  const styles: Record<PageStatus, string> = {
    idea: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300",
    researching: "bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-400",
    drafting: "bg-violet-50 dark:bg-violet-950 text-violet-600 dark:text-violet-400",
    in_review: "bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400",
    published: "bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400",
    needs_update: "bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400",
  };
  return <span className={`text-xs rounded-full px-2 py-0.5 ${styles[status]}`}>{PAGE_STATUS_LABELS[status]}</span>;
}

function formatMonth(month: string): string {
  if (month === "No date") return month;
  const [y, m] = month.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

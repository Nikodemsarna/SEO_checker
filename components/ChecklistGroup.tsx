import type { CheckCategory, CheckStatus } from "@/lib/types";

const STATUS_STYLE: Record<CheckStatus, { icon: string; className: string }> = {
  pass: { icon: "✓", className: "text-emerald-600 dark:text-emerald-400" },
  warn: { icon: "!", className: "text-amber-600 dark:text-amber-400" },
  fail: { icon: "✕", className: "text-rose-600 dark:text-rose-400" },
};

export function ChecklistGroup({ categories }: { categories: CheckCategory[] }) {
  return (
    <div className="space-y-5">
      {categories.map((cat) => (
        <div key={cat.key}>
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">{cat.label}</h4>
          <ul className="space-y-1.5">
            {cat.checks.map((c) => {
              const style = STATUS_STYLE[c.status];
              return (
                <li key={c.id} className="flex gap-2.5 text-sm rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2">
                  <span className={`shrink-0 font-bold ${style.className}`} aria-hidden>
                    {style.icon}
                  </span>
                  <div>
                    <div className="font-medium text-slate-800 dark:text-slate-100">{c.label}</div>
                    <div className="text-slate-500 dark:text-slate-400">{c.message}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

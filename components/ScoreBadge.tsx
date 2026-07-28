function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 ring-emerald-200 dark:ring-emerald-900";
  if (score >= 60) return "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 ring-amber-200 dark:ring-amber-900";
  return "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950 ring-rose-200 dark:ring-rose-900";
}

export function ScoreBadge({ label, score, size = "md" }: { label: string; score: number; size?: "sm" | "md" | "lg" }) {
  const dims = size === "lg" ? "h-20 w-20 text-2xl" : size === "sm" ? "h-9 w-9 text-xs" : "h-14 w-14 text-lg";
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`flex items-center justify-center rounded-full ring-2 font-semibold ${dims} ${scoreColor(score)}`}>
        {score}
      </div>
      <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
    </div>
  );
}

export function ScoreInline({ label, score }: { label: string; score: number | null | undefined }) {
  if (score === null || score === undefined) {
    return <span className="text-xs text-slate-400">{label}: —</span>;
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ring-1 ${scoreColor(score)}`}>
      {label} {score}
    </span>
  );
}

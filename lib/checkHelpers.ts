import type { CheckCategory, CheckResult, CheckStatus } from "./types";

export function mk(
  id: string,
  label: string,
  status: CheckStatus,
  message: string,
  weight: number
): CheckResult {
  return { id, label, status, message, weight };
}

export function keywordIncluded(haystack: string | null | undefined, keyword: string): boolean {
  if (!haystack) return false;
  return haystack.toLowerCase().includes(keyword.toLowerCase());
}

export function category(key: string, label: string, checks: CheckResult[]): CheckCategory {
  return { key, label, checks };
}

/** Weighted score 0-100: pass = full weight, warn = half weight, fail = 0. */
export function scoreCategories(categories: CheckCategory[]): number {
  let earned = 0;
  let total = 0;
  for (const cat of categories) {
    for (const c of cat.checks) {
      total += c.weight;
      if (c.status === "pass") earned += c.weight;
      else if (c.status === "warn") earned += c.weight * 0.5;
    }
  }
  if (total === 0) return 0;
  return Math.round((earned / total) * 100);
}

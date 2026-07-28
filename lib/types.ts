export const PAGE_TYPES = [
  "program",
  "admissions",
  "faculty",
  "blog",
  "event",
  "other",
] as const;
export type PageType = (typeof PAGE_TYPES)[number];

export const PAGE_TYPE_LABELS: Record<PageType, string> = {
  program: "Program / Degree page",
  admissions: "Admissions / Landing page",
  faculty: "Faculty / Research profile",
  blog: "Blog / News article",
  event: "Event page",
  other: "Other",
};

export const PAGE_STATUSES = [
  "idea",
  "researching",
  "drafting",
  "in_review",
  "published",
  "needs_update",
] as const;
export type PageStatus = (typeof PAGE_STATUSES)[number];

export const PAGE_STATUS_LABELS: Record<PageStatus, string> = {
  idea: "Idea",
  researching: "Researching",
  drafting: "Drafting",
  in_review: "In review",
  published: "Published",
  needs_update: "Needs update",
};

export interface Cluster {
  id: number;
  name: string;
  pillar_keyword: string | null;
  description: string | null;
  created_at: string;
}

export interface TrackedPage {
  id: number;
  url: string | null;
  title: string;
  page_type: PageType;
  target_keyword: string | null;
  cluster_id: number | null;
  status: PageStatus;
  owner: string | null;
  target_publish_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // joined
  cluster_name?: string | null;
  latest_seo_score?: number | null;
  latest_geo_score?: number | null;
  latest_audit_at?: string | null;
}

export type CheckStatus = "pass" | "warn" | "fail";

export interface CheckResult {
  id: string;
  label: string;
  status: CheckStatus;
  message: string;
  weight: number;
}

export interface CheckCategory {
  key: string;
  label: string;
  checks: CheckResult[];
}

export interface AnalysisResults {
  seoScore: number;
  geoScore: number;
  seoCategories: CheckCategory[];
  geoCategories: CheckCategory[];
  meta: {
    title: string | null;
    wordCount: number;
    pageType: PageType;
    targetKeyword: string | null;
    source: "url" | "paste";
    fetchedUrl?: string | null;
  };
}

export interface Audit {
  id: number;
  page_id: number | null;
  source: "url" | "paste";
  seo_score: number;
  geo_score: number;
  results_json: string;
  created_at: string;
}

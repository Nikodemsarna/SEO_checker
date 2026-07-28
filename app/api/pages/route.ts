import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { PAGE_STATUSES, PAGE_TYPES, type TrackedPage } from "@/lib/types";

export async function GET() {
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
  return NextResponse.json({ pages });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const title = String(body.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }
  const pageType = PAGE_TYPES.includes(body.page_type) ? body.page_type : "other";
  const status = PAGE_STATUSES.includes(body.status) ? body.status : "idea";

  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO pages (url, title, page_type, target_keyword, cluster_id, status, owner, target_publish_date, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      body.url?.trim() || null,
      title,
      pageType,
      body.target_keyword?.trim() || null,
      body.cluster_id || null,
      status,
      body.owner?.trim() || null,
      body.target_publish_date || null,
      body.notes?.trim() || null
    );
  const page = db.prepare(`SELECT * FROM pages WHERE id = ?`).get(result.lastInsertRowid);
  return NextResponse.json({ page }, { status: 201 });
}

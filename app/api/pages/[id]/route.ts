import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { PAGE_STATUSES, PAGE_TYPES } from "@/lib/types";
import type { Audit, TrackedPage } from "@/lib/types";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/pages/[id]">) {
  const { id } = await ctx.params;
  const db = getDb();
  const page = db
    .prepare(
      `SELECT p.*, c.name as cluster_name FROM pages p LEFT JOIN clusters c ON c.id = p.cluster_id WHERE p.id = ?`
    )
    .get(id) as TrackedPage | undefined;
  if (!page) {
    return NextResponse.json({ error: "Page not found." }, { status: 404 });
  }
  const audits = db
    .prepare(`SELECT * FROM audits WHERE page_id = ? ORDER BY created_at DESC LIMIT 20`)
    .all(id) as Audit[];
  return NextResponse.json({ page, audits });
}

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/pages/[id]">) {
  const { id } = await ctx.params;
  const body = await req.json();
  const db = getDb();
  const existing = db.prepare(`SELECT * FROM pages WHERE id = ?`).get(id) as TrackedPage | undefined;
  if (!existing) {
    return NextResponse.json({ error: "Page not found." }, { status: 404 });
  }

  const pageType = PAGE_TYPES.includes(body.page_type) ? body.page_type : existing.page_type;
  const status = PAGE_STATUSES.includes(body.status) ? body.status : existing.status;

  db.prepare(
    `UPDATE pages SET
       url = ?, title = ?, page_type = ?, target_keyword = ?, cluster_id = ?,
       status = ?, owner = ?, target_publish_date = ?, notes = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    body.url?.trim() || null,
    String(body.title ?? existing.title).trim() || existing.title,
    pageType,
    body.target_keyword?.trim() || null,
    body.cluster_id || null,
    status,
    body.owner?.trim() || null,
    body.target_publish_date || null,
    body.notes?.trim() || null,
    id
  );

  const page = db.prepare(`SELECT * FROM pages WHERE id = ?`).get(id);
  return NextResponse.json({ page });
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/pages/[id]">) {
  const { id } = await ctx.params;
  const db = getDb();
  db.prepare(`DELETE FROM pages WHERE id = ?`).run(id);
  return NextResponse.json({ ok: true });
}

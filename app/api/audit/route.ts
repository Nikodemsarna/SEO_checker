import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { analyze, FetchPageError } from "@/lib/analyze";
import { PAGE_TYPES } from "@/lib/types";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const source = body.source === "url" ? "url" : "paste";
  const pageType = PAGE_TYPES.includes(body.pageType) ? body.pageType : "other";

  let results;
  try {
    results = await analyze({
      source,
      url: body.url,
      content: body.content,
      pageType,
      targetKeyword: body.targetKeyword,
    });
  } catch (err) {
    if (err instanceof FetchPageError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Something went wrong analyzing that content." }, { status: 500 });
  }

  let auditId: number | null = null;
  const pageId = body.pageId ? Number(body.pageId) : null;
  if (pageId) {
    const db = getDb();
    const info = db
      .prepare(
        `INSERT INTO audits (page_id, source, seo_score, geo_score, results_json) VALUES (?, ?, ?, ?, ?)`
      )
      .run(pageId, source, results.seoScore, results.geoScore, JSON.stringify(results));
    auditId = Number(info.lastInsertRowid);
    db.prepare(`UPDATE pages SET updated_at = datetime('now') WHERE id = ?`).run(pageId);
  }

  return NextResponse.json({ results, auditId });
}

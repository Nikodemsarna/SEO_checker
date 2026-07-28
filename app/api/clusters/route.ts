import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { Cluster } from "@/lib/types";

export async function GET() {
  const db = getDb();
  const clusters = db
    .prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM pages p WHERE p.cluster_id = c.id) as page_count
       FROM clusters c ORDER BY c.name ASC`
    )
    .all();
  return NextResponse.json({ clusters });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const name = String(body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Cluster name is required." }, { status: 400 });
  }
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO clusters (name, pillar_keyword, description) VALUES (?, ?, ?)`
    )
    .run(name, body.pillar_keyword?.trim() || null, body.description?.trim() || null);
  const cluster = db
    .prepare(`SELECT * FROM clusters WHERE id = ?`)
    .get(result.lastInsertRowid) as Cluster;
  return NextResponse.json({ cluster }, { status: 201 });
}

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/clusters/[id]">) {
  const { id } = await ctx.params;
  const db = getDb();
  db.prepare(`UPDATE pages SET cluster_id = NULL WHERE cluster_id = ?`).run(id);
  db.prepare(`DELETE FROM clusters WHERE id = ?`).run(id);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/clusters/[id]">) {
  const { id } = await ctx.params;
  const body = await req.json();
  const db = getDb();
  const existing = db.prepare(`SELECT * FROM clusters WHERE id = ?`).get(id);
  if (!existing) {
    return NextResponse.json({ error: "Cluster not found." }, { status: 404 });
  }
  db.prepare(
    `UPDATE clusters SET name = ?, pillar_keyword = ?, description = ? WHERE id = ?`
  ).run(
    body.name?.trim() || (existing as { name: string }).name,
    body.pillar_keyword?.trim() || null,
    body.description?.trim() || null,
    id
  );
  const cluster = db.prepare(`SELECT * FROM clusters WHERE id = ?`).get(id);
  return NextResponse.json({ cluster });
}

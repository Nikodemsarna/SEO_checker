import { NextRequest, NextResponse } from "next/server";
import { scanSite, FetchPageError } from "@/lib/siteScan";
import { PAGE_TYPES } from "@/lib/types";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const pageType = PAGE_TYPES.includes(body.pageType) ? body.pageType : "other";
  const maxPages = Number(body.maxPages);

  let summary;
  try {
    summary = await scanSite({
      url: body.url,
      pageType,
      targetKeyword: body.targetKeyword,
      maxPages: Number.isFinite(maxPages) && maxPages > 0 ? maxPages : undefined,
    });
  } catch (err) {
    if (err instanceof FetchPageError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Something went wrong scanning that domain." }, { status: 500 });
  }

  return NextResponse.json({ summary });
}

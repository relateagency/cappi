import { NextRequest, NextResponse } from "next/server";

// BrandFetch Suche / Autocomplete. Key bleibt server-side.
const KEY = process.env.BRANDFETCH_KEY || "";

const jsonHeaders = {
  "Content-Type": "application/json",
  "Cache-Control": "s-maxage=86400, stale-while-revalidate",
};

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (q.length < 2) {
    return new NextResponse("[]", { status: 200, headers: { "Content-Type": "application/json" } });
  }
  try {
    const r = await fetch(
      "https://api.brandfetch.io/v2/search/" + encodeURIComponent(q),
      { headers: { Authorization: "Bearer " + KEY } }
    );
    const body = await r.text();
    return new NextResponse(body, { status: r.status, headers: jsonHeaders });
  } catch {
    return new NextResponse("[]", { status: 200, headers: { "Content-Type": "application/json" } });
  }
}

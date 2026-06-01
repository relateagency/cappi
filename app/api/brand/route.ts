import { NextRequest, NextResponse } from "next/server";

// BrandFetch Brand-Lookup (Logos, Farben, Name). Key bleibt server-side.
const KEY = process.env.BRANDFETCH_KEY || "";

export async function GET(req: NextRequest) {
  const domain = (req.nextUrl.searchParams.get("domain") || "").trim();
  if (!domain) {
    return NextResponse.json({ error: "missing domain" }, { status: 400 });
  }
  try {
    const r = await fetch(
      "https://api.brandfetch.io/v2/brands/" + encodeURIComponent(domain),
      { headers: { Authorization: "Bearer " + KEY } }
    );
    const body = await r.text();
    return new NextResponse(body, {
      status: r.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "s-maxage=86400, stale-while-revalidate",
      },
    });
  } catch {
    return NextResponse.json({ error: "upstream failed" }, { status: 502 });
  }
}

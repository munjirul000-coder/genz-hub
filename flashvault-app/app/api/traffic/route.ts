import { NextResponse } from "next/server";
import { markViewer } from "@/lib/traffic";
import { rateLimit } from "@/lib/rate-limit";

// Real viewer count (no fake numbers). Clients poll this with their viewer id.
export async function GET(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || "anon";
  // 120/min per IP: a real tab polls every 30s (2/min). BD mobile carriers put
  // many users behind one CGNAT IP, so keep it generous but bounded.
  const rl = rateLimit(`traffic:${ip}`, 120, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  const url = new URL(req.url);
  const v = url.searchParams.get("v") || "";
  const viewers = markViewer(v);
  return NextResponse.json(
    { viewers, serverTime: Date.now() },
    { headers: { "Cache-Control": "no-store" } }
  );
}

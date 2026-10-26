import { NextResponse } from "next/server";
import { peekDB, getRealStats } from "@/lib/db";
import { computeDropState } from "@/lib/drop-engine";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || "anon";
  // 300/min per IP: generous for real users (BD mobile carriers share CGNAT IPs,
  // so many legit visitors can come from one address) while still stopping scrapers
  const rl = rateLimit(`products:${ip}`, 300, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  try {
    const db = peekDB(); // read-only fast path — no full-DB clone per request
    const dropState = computeDropState(db.settings, db.drop, db.drops);
    const stats = getRealStats();

    // Only return live/approved products for public, but include real discount
    const liveProducts = db.products
      .filter((p) => p.status === "live" || p.status === "approved")
      .map((p) => ({
        ...p,
        // Ensure discount is server-calculated, never trust client
        discountPercent: Math.round(((p.originalPrice - p.vaultPrice) / p.originalPrice) * 100),
      }))
      .sort((a, b) => b.createdAt - a.createdAt);

    return NextResponse.json({
      products: liveProducts,
      drop: {
        ...db.drop,
        computed: dropState,
        serverTime: Date.now(),
      },
      stats: {
        liveCount: stats.liveProducts,
        totalSold: stats.totalSold,
        avgDiscount: stats.avgDiscount,
        totalStock: stats.totalStock,
        // Real stats only
      },
    }, {
      headers: {
        "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30",
      }
    });
  } catch (e) {
    console.error("[api/products] error", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

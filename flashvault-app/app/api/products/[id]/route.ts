import { NextResponse } from "next/server";
import { readDB } from "@/lib/db";
import { computeDropState } from "@/lib/drop-engine";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const ip = req.headers.get("x-forwarded-for") || "anon";
  const rl = rateLimit(`product:${ip}`, 60, 60_000);
  if (!rl.ok) return NextResponse.json({ error: "Rate limited" }, { status: 429 });

  try {
    const { id } = params;
    if (!id) return NextResponse.json({ error: "Product ID required" }, { status: 400 });

    const db = readDB();
    const product = db.products.find(p => p.id === id);
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const merchant = db.merchants.find(m => m.id === product.merchantId) || null;
    const dropState = computeDropState(db.settings, db.drop, db.drops);

    // Server-calculated discount - never trust client
    const discountPercent = Math.round(((product.originalPrice - product.vaultPrice) / product.originalPrice) * 100);

    // Real inventory
    const isSoldOut = product.availableQuantity <= 0 || product.status === "soldout";

    return NextResponse.json({
      product: {
        ...product,
        discountPercent, // ensure server calc
      },
      merchant: merchant ? {
        id: merchant.id,
        name: merchant.name,
        brand: merchant.brand,
        verified: merchant.verified,
        status: merchant.status,
        totalSales: merchant.totalSales,
        totalOrders: merchant.totalOrders,
      } : null,
      drop: {
        state: dropState.state,
        isLive: dropState.isLive,
        isLocked: dropState.isLocked,
        nextDropAt: dropState.nextDropAt,
        liveEndsAt: dropState.liveEndsAt,
        serverTime: dropState.serverTime,
        timezone: dropState.timezone,
      },
      isSoldOut,
      realInventory: {
        available: product.availableQuantity,
        sold: product.soldQuantity,
        total: product.stock,
      }
    }, {
      headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30" }
    });
  } catch (e) {
    console.error("[api/products/[id]] error", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

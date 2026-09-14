import { NextResponse } from "next/server";
import { verifyUserRequest } from "@/lib/auth";
import { readDB, writeDB } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

// Wishlist DB + guest merge dedup cross-device
// Stores in DB.wishlists: { id, userId, productId, createdAt }
// For guest, client sends local wishlist and merges on login

function ensureWishlistStore(db: any) {
  if (!db.wishlists) db.wishlists = [];
  return db.wishlists;
}

export async function GET(req: Request) {
  const auth = verifyUserRequest(req);
  if (!auth.ok) {
    // Guest - return empty, client uses localStorage
    return NextResponse.json({ wishlist: [], guest: true });
  }

  const db = readDB();
  const items = ensureWishlistStore(db).filter((w: any) => w.userId === auth.user.id);
  const productIds = items.map((w: any) => w.productId);
  return NextResponse.json({ wishlist: items, productIds });
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || "anon";
  const rl = rateLimit(`wishlist:${ip}`, 60, 60_000);
  if (!rl.ok) return NextResponse.json({ error: "Rate limited" }, { status: 429 });

  const auth = verifyUserRequest(req);
  if (!auth.ok) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  try {
    const body = await req.json();
    const { productId, productIds, action } = body as { productId?: string; productIds?: string[]; action?: "add" | "remove" | "merge" | "toggle" };

    const db = readDB();
    const wishlists = ensureWishlistStore(db);

    // Merge guest wishlist (dedup)
    if (action === "merge" && productIds && Array.isArray(productIds)) {
      const existingIds = new Set(wishlists.filter((w: any) => w.userId === auth.user.id).map((w: any) => w.productId));
      let added = 0;
      for (const pid of productIds) {
        if (!pid) continue;
        if (existingIds.has(pid)) continue;
        // Validate product exists
        if (!db.products.find((p: any) => p.id === pid)) continue;
        wishlists.push({
          id: `wish_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          userId: auth.user.id,
          productId: pid,
          createdAt: new Date().toISOString(),
        });
        added++;
        existingIds.add(pid);
      }
      writeDB(db);
      const all = wishlists.filter((w: any) => w.userId === auth.user.id);
      return NextResponse.json({ ok: true, added, wishlist: all, productIds: all.map((w: any) => w.productId) });
    }

    if (!productId) return NextResponse.json({ error: "productId required" }, { status: 400 });

    const productExists = db.products.find((p: any) => p.id === productId);
    if (!productExists) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const existingIdx = wishlists.findIndex((w: any) => w.userId === auth.user.id && w.productId === productId);

    if (action === "remove") {
      if (existingIdx !== -1) {
        wishlists.splice(existingIdx, 1);
        writeDB(db);
      }
      const all = wishlists.filter((w: any) => w.userId === auth.user.id);
      return NextResponse.json({ ok: true, wishlist: all, productIds: all.map((w: any) => w.productId) });
    }

    if (action === "toggle") {
      if (existingIdx !== -1) {
        wishlists.splice(existingIdx, 1);
      } else {
        wishlists.push({
          id: `wish_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          userId: auth.user.id,
          productId,
          createdAt: new Date().toISOString(),
        });
      }
      writeDB(db);
      const all = wishlists.filter((w: any) => w.userId === auth.user.id);
      return NextResponse.json({ ok: true, inWishlist: existingIdx === -1, wishlist: all, productIds: all.map((w: any) => w.productId) });
    }

    // Default add
    if (existingIdx !== -1) {
      return NextResponse.json({ ok: true, message: "Already in wishlist", alreadyExists: true });
    }

    wishlists.push({
      id: `wish_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      userId: auth.user.id,
      productId,
      createdAt: new Date().toISOString(),
    });
    writeDB(db);

    const all = wishlists.filter((w: any) => w.userId === auth.user.id);
    return NextResponse.json({ ok: true, wishlist: all, productIds: all.map((w: any) => w.productId) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const auth = verifyUserRequest(req);
  if (!auth.ok) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const productId = searchParams.get("productId");
  if (!productId) return NextResponse.json({ error: "productId required" }, { status: 400 });

  const db = readDB();
  const wishlists = ensureWishlistStore(db);
  const idx = wishlists.findIndex((w: any) => w.userId === auth.user.id && w.productId === productId);
  if (idx !== -1) {
    wishlists.splice(idx, 1);
    writeDB(db);
  }

  const all = wishlists.filter((w: any) => w.userId === auth.user.id);
  return NextResponse.json({ ok: true, wishlist: all, productIds: all.map((w: any) => w.productId) });
}

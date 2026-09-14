import { NextResponse } from "next/server";
import { verifyUserRequest } from "@/lib/auth";
import { readDB, writeDB } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

// Merchant products: My Products/Add/Edit/Rejected->Resubmit/Inventory/Orders/Sales - own data only

export async function GET(req: Request) {
  const auth = verifyUserRequest(req, ["MERCHANT", "ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  const db = readDB();
  const merchantId = auth.user.merchantId;

  if (!merchantId && auth.user.role === "MERCHANT") {
    return NextResponse.json({ error: "Merchant profile not found" }, { status: 404 });
  }

  let products = db.products;
  if (auth.user.role === "MERCHANT") {
    products = products.filter(p => p.merchantId === merchantId);
  }

  // Stats
  const stats = {
    total: products.length,
    pending: products.filter(p => p.status === "pending").length,
    approved: products.filter(p => p.status === "approved" || p.status === "live").length,
    live: products.filter(p => p.status === "live").length,
    rejected: products.filter(p => p.status === "rejected").length,
    soldout: products.filter(p => p.status === "soldout").length,
    totalStock: products.reduce((s, p) => s + (p.availableQuantity || 0), 0),
    totalSold: products.reduce((s, p) => s + (p.soldQuantity || 0), 0),
  };

  return NextResponse.json({ products, stats, merchantId });
}

export async function PUT(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || "anon";
  const rl = rateLimit(`merchant_edit:${ip}`, 20, 60_000);
  if (!rl.ok) return NextResponse.json({ error: "Rate limited" }, { status: 429 });

  const auth = verifyUserRequest(req, ["MERCHANT"]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const body = await req.json();
    const { id, title, description, originalPrice, vaultPrice, stock, category, size, action } = body;

    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const db = readDB();
    const product = db.products.find(p => p.id === id);
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    // Ownership check - own data only
    if (product.merchantId !== auth.user.merchantId) {
      return NextResponse.json({ error: "Forbidden - not your product" }, { status: 403 });
    }

    // Rejected -> Resubmit flow
    if (action === "resubmit") {
      if (product.status !== "rejected") {
        return NextResponse.json({ error: "Only rejected products can be resubmitted" }, { status: 400 });
      }
      product.status = "pending";
      product.approvalStatus = "pending";
      product.verificationStatus = "unverified";
      product.updatedAt = Date.now();
      writeDB(db);
      return NextResponse.json({ ok: true, product, message: "Resubmitted for review" });
    }

    // Edit allowed only for pending/rejected or if approved but not live? For safety, allow edit for pending/rejected
    if (!["pending", "rejected"].includes(product.status)) {
      return NextResponse.json({ error: `Cannot edit product with status ${product.status}. Only pending/rejected editable.` }, { status: 403 });
    }

    if (title) product.title = title;
    if (description) product.description = description;
    if (category) product.category = category;
    if (size) product.size = size;
    if (stock !== undefined) {
      const s = Number(stock);
      if (s < 0) return NextResponse.json({ error: "Stock cannot be negative" }, { status: 400 });
      product.stock = s;
      product.availableQuantity = s - (product.soldQuantity || 0);
      if (product.availableQuantity < 0) product.availableQuantity = 0;
    }
    if (originalPrice !== undefined && vaultPrice !== undefined) {
      const orig = Number(originalPrice);
      const vault = Number(vaultPrice);
      if (orig <= 0 || vault <= 0) return NextResponse.json({ error: "Invalid pricing" }, { status: 400 });
      if (vault >= orig) return NextResponse.json({ error: "Vault price must be less than original" }, { status: 400 });
      const discount = Math.round(((orig - vault) / orig) * 100);
      if (discount < 10 || discount > 90) return NextResponse.json({ error: "Discount must be 10-90%" }, { status: 400 });
      product.originalPrice = orig;
      product.vaultPrice = vault;
      product.discountPercent = discount;
    }

    product.updatedAt = Date.now();
    writeDB(db);

    return NextResponse.json({ ok: true, product });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const auth = verifyUserRequest(req, ["MERCHANT"]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const db = readDB();
  const idx = db.products.findIndex(p => p.id === id);
  if (idx === -1) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  if (db.products[idx].merchantId !== auth.user.merchantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!["pending", "rejected"].includes(db.products[idx].status)) {
    return NextResponse.json({ error: "Can only delete pending/rejected products" }, { status: 403 });
  }

  db.products.splice(idx, 1);
  writeDB(db);
  return NextResponse.json({ ok: true });
}

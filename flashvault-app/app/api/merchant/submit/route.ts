import { NextResponse } from "next/server";
import { readDB, writeDB } from "@/lib/db";
import { productSubmitSchema, calculateDiscountPercent, validatePricing } from "@/lib/validators";
import { rateLimit } from "@/lib/rate-limit";
import { dbMutex } from "@/lib/store";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "anon";
  const rl = rateLimit(`merchant:submit:${ip}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Rate limited - too many submissions. Try again in 1 minute." }, { status: 429 });
  }

  try {
    const body = await req.json();
    const parsed = productSubmitSchema.safeParse({
      ...body,
      originalPrice: Number(body.originalPrice),
      vaultPrice: Number(body.vaultPrice),
      stock: Number(body.stock),
    });

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message || parsed.error.message }, { status: 400 });
    }

    const data = parsed.data;

    // Server-side pricing validation - prevent fake discounts
    const pricingCheck = validatePricing(data.originalPrice, data.vaultPrice);
    if (!pricingCheck.valid) {
      return NextResponse.json({ error: pricingCheck.error }, { status: 400 });
    }

    const release = await dbMutex.acquire();
    try {
      const db = readDB();

      // Check if merchant exists or create
      let merchant = db.merchants.find(m => m.phone === data.phone);
      if (!merchant) {
        merchant = {
          id: "m" + Date.now() + Math.random().toString(36).slice(2, 6),
          name: data.merchantName,
          brand: data.brand,
          phone: data.phone,
          email: "",
          verified: false,
          status: "pending",
          totalSales: 0,
          totalOrders: 0,
          payoutBalance: 0,
          totalPayouts: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        db.merchants.push(merchant);
      }

      // Suspicious pricing detection
      const discount = calculateDiscountPercent(data.originalPrice, data.vaultPrice);
      const isSuspicious = discount > 85 || data.originalPrice > data.vaultPrice * 10;

      const newProduct = {
        id: "p" + Date.now() + Math.random().toString(36).slice(2, 6),
        brand: data.brand,
        title: data.title,
        description: data.description || `${data.brand} - ${data.title}`,
        originalPrice: data.originalPrice,
        vaultPrice: data.vaultPrice,
        discountPercent: discount, // server-calculated
        stock: data.stock,
        availableQuantity: data.stock,
        sold: 0,
        soldQuantity: 0,
        images: ["https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&h=750&fit=crop"],
        image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&h=750&fit=crop",
        category: data.category,
        size: data.size,
        condition: data.condition || "Surplus",
        location: data.location || "Dhaka, Bangladesh",
        deliveryInfo: "Pathao 24h inside Dhaka",
        returnPolicy: "No return - vault sale",
        verificationStatus: isSuspicious ? "suspicious" as const : "unverified" as const,
        approvalStatus: "pending" as const,
        status: "pending" as const,
        merchantId: merchant.id,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      db.products.push(newProduct);
      writeDB(db);

      return NextResponse.json({
        ok: true,
        product: newProduct,
        merchant,
        message: isSuspicious ? "Submitted for review - pricing flagged for verification" : "Submitted successfully",
        discount,
      });
    } finally {
      release();
    }
  } catch (e) {
    console.error("[api/merchant/submit] error", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

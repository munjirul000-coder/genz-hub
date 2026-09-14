import { NextResponse } from "next/server";
import { readDB, writeDB } from "@/lib/db";
import { orderCreateSchema } from "@/lib/validators";
import { computeDropState } from "@/lib/drop-engine";
import { dbMutex } from "@/lib/store";
import { rateLimit } from "@/lib/rate-limit";
import { verifyUserRequest } from "@/lib/auth";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || "anon";
  const rl = rateLimit(`order:${ip}`, 5, 60_000);
  if (!rl.ok) return NextResponse.json({ error: "Too many order attempts. Wait 1 minute." }, { status: 429 });

  // Auth required for checkout - server-enforced
  const auth = verifyUserRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "Login required to checkout. Please sign in to continue.", code: "AUTH_REQUIRED" }, { status: 401 });
  }

  // Only CUSTOMER, MERCHANT, ADMIN, SUPER_ADMIN can order, but check suspended
  if (auth.user.isSuspended) return NextResponse.json({ error: "Account suspended" }, { status: 403 });

  try {
    const body = await req.json();
    const parsed = orderCreateSchema.safeParse({
      ...body,
      quantity: Number(body.quantity) || 1,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message || "Invalid order data" }, { status: 400 });
    }

    const data = parsed.data;

    const release = await dbMutex.acquire();
    try {
      const db = readDB();

      // Server-side drop enforcement - CRITICAL
      const dropState = computeDropState(db.settings, db.drop, db.drops);
      if (!dropState.isLive) {
        return NextResponse.json({
          error: "Vault is locked. Orders only allowed during live drop.",
          state: dropState.state,
          nextDropAt: dropState.nextDropAt,
          serverTime: Date.now(),
        }, { status: 403 });
      }

      // Idempotency check - prevent duplicate orders from double click
      if (db.idempotencyKeys[data.idempotencyKey]) {
        const existingOrderId = db.idempotencyKeys[data.idempotencyKey].orderId;
        const existingOrder = db.orders.find(o => o.id === existingOrderId);
        if (existingOrder) {
          // Ensure ownership - user can only see own idempotent order
          if ((existingOrder as any).customerId && (existingOrder as any).customerId !== auth.user.id) {
            return NextResponse.json({ error: "Forbidden - not your order" }, { status: 403 });
          }
          return NextResponse.json({ ok: true, order: existingOrder, duplicate: true, message: "Order already created" });
        }
      }

      const product = db.products.find(p => p.id === data.productId);
      if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

      if (product.status !== "live" && product.status !== "approved") {
        return NextResponse.json({ error: "Product not available for purchase" }, { status: 403 });
      }

      // Inventory check with race condition protection
      if (product.availableQuantity < data.quantity) {
        return NextResponse.json({ error: `Only ${product.availableQuantity} pcs left. Cannot order ${data.quantity}.` }, { status: 409 });
      }

      // Reserve inventory atomically
      product.availableQuantity -= data.quantity;
      product.soldQuantity += data.quantity;
      product.sold += data.quantity;
      if (product.availableQuantity === 0) {
        product.status = "soldout";
        product.approvalStatus = "soldout";
      }
      product.updatedAt = Date.now();

      const commission = Math.round(product.vaultPrice * data.quantity * (db.settings.commissionPercent / 100));
      const merchantEarning = product.vaultPrice * data.quantity - commission;
      const deliveryFee = data.city.toLowerCase().includes("dhaka") ? db.settings.shippingFeeInsideDhaka : db.settings.shippingFeeOutside;
      const totalAmount = product.vaultPrice * data.quantity + deliveryFee;

      // Separate payment vs order vs delivery status - production safe
      const paymentMethod = (data as any).paymentMethod || "cod";
      const isCOD = paymentMethod === "cod";
      const order = {
        id: "o" + Date.now() + Math.random().toString(36).slice(2, 6),
        productId: product.id,
        productTitle: product.title,
        quantity: data.quantity,
        amount: product.vaultPrice * data.quantity,
        commission,
        merchantEarning,
        customerId: auth.user.id,
        customerPhone: data.customerPhone,
        customerName: data.customerName || auth.user.name,
        customerEmail: auth.user.email,
        shippingAddress: data.address,
        city: data.city,
        area: data.area,
        deliveryFee,
        totalAmount,
        status: "confirmed" as const,
        paymentStatus: "pending" as const,
        deliveryStatus: "processing" as const,
        paymentMethod: paymentMethod,
        courierTracking: `FV-${Date.now().toString().slice(-6)}`,
        courierName: "Pathao",
        idempotencyKey: data.idempotencyKey,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      db.orders.push(order);
      db.idempotencyKeys[data.idempotencyKey] = { orderId: order.id, createdAt: Date.now() };

      // Update merchant stats
      const merchant = db.merchants.find(m => m.id === product.merchantId);
      if (merchant) {
        merchant.totalOrders += 1;
        merchant.totalSales += order.amount;
        merchant.updatedAt = Date.now();
      }

      // Update user's phone if not set
      const userInDb = db.users.find(u => u.id === auth.user.id);
      if (userInDb && !userInDb.phone && data.customerPhone) {
        userInDb.phone = data.customerPhone;
      }

      // Cleanup old idempotency keys (>24h)
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      for (const k in db.idempotencyKeys) {
        if (db.idempotencyKeys[k].createdAt < cutoff) delete db.idempotencyKeys[k];
      }

      writeDB(db);

      return NextResponse.json({ ok: true, order, dropState: dropState.state });
    } finally {
      release();
    }
  } catch (e) {
    console.error("[api/orders/create] error", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

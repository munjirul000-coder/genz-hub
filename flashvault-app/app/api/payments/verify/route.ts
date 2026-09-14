import { NextResponse } from "next/server";
import { verifyUserRequest } from "@/lib/auth";
import { getPaymentGateway, PaymentMethod } from "@/lib/payment";
import { readDB, writeDB } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || "anon";
  const rl = rateLimit(`payment_verify:${ip}`, 20, 60_000);
  if (!rl.ok) return NextResponse.json({ error: "Rate limited" }, { status: 429 });

  const auth = verifyUserRequest(req);
  if (!auth.ok) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  try {
    const body = await req.json();
    const { gatewayId, orderId, method = "bkash" } = body as { gatewayId: string; orderId: string; method: PaymentMethod };

    if (!gatewayId) return NextResponse.json({ error: "gatewayId required" }, { status: 400 });

    const db = readDB();
    let order: any = null;
    if (orderId) {
      order = db.orders.find(o => o.id === orderId);
      if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
      // Ownership check - only owner or admin can verify
      if ((order as any).customerId && (order as any).customerId !== auth.user.id && !["ADMIN", "SUPER_ADMIN"].includes(auth.user.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const gateway = getPaymentGateway(method);
    const result = await gateway.verifyPayment({ gatewayId, orderId, method });

    if (result.success && result.status === "PAID" && order) {
      // ONLY server verification can mark as PAID - never frontend
      order.paymentStatus = "paid";
      order.status = "confirmed";
      (order as any).paidAt = new Date().toISOString();
      writeDB(db);
    }

    return NextResponse.json({
      ok: result.success,
      verification: result,
      order: order ? { id: order.id, paymentStatus: order.paymentStatus, status: order.status } : null,
    });
  } catch (e: any) {
    console.error("[payments/verify] error", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

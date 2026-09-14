import { NextResponse } from "next/server";
import { verifyUserRequest } from "@/lib/auth";
import { getPaymentGateway, getPaymentConfig, PaymentMethod } from "@/lib/payment";
import { readDB, writeDB } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

export async function GET() {
  return NextResponse.json(getPaymentConfig());
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || "anon";
  const rl = rateLimit(`payment_create:${ip}`, 10, 60_000);
  if (!rl.ok) return NextResponse.json({ error: "Rate limited" }, { status: 429 });

  const auth = verifyUserRequest(req);
  if (!auth.ok) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  try {
    const body = await req.json();
    const { orderId, method = "bkash" } = body as { orderId: string; method: PaymentMethod };

    if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 });

    const db = readDB();
    const order = db.orders.find(o => o.id === orderId);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    // Ownership check
    if ((order as any).customerId && (order as any).customerId !== auth.user.id) {
      return NextResponse.json({ error: "Forbidden - not your order" }, { status: 403 });
    }

    const gateway = getPaymentGateway(method);

    // Create payment via gateway - never mark as PAID without verification
    const result = await gateway.createPayment({
      orderId: order.id,
      amount: order.totalAmount,
      customerPhone: order.customerPhone,
      customerName: order.customerName,
      customerEmail: (order as any).customerEmail || auth.user.email,
      method,
    });

    // Create payment record in DB with PENDING status - not PAID yet
    const existingPayment = db.orders.find(o => o.id === orderId);
    if (existingPayment) {
      // For JSON DB, we store payment info in order, but ideally separate Payment table in Prisma
      // For now, keep order paymentStatus as PENDING until verified via webhook/verify
      if (result.requiresCredentials) {
        // If gateway not configured, keep order as PENDING payment, not PAID
        order.paymentStatus = "pending" as any;
      }
      writeDB(db);
    }

    return NextResponse.json({
      ok: result.success || !!result.requiresCredentials,
      payment: result,
      orderId: order.id,
      message: result.requiresCredentials
        ? `Payment gateway ${method} not configured - ${result.error}. Required env: ${result.requiredEnv?.join(", ")}. Order remains PENDING until gateway configured and verified.`
        : "Payment creation initiated - redirect to gatewayUrl if provided, then verify via /api/payments/verify or webhook",
    });
  } catch (e: any) {
    console.error("[payments/create] error", e);
    return NextResponse.json({ error: e.message || "Payment creation failed" }, { status: 500 });
  }
}

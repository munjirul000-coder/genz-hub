import { NextResponse } from "next/server";
import { getPaymentGateway, PaymentMethod } from "@/lib/payment";
import { readDB, writeDB } from "@/lib/db";

// Webhooks must be verified server-side, never trust frontend
// bKash and SSLCommerz will POST here

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const method = (url.searchParams.get("method") || "bkash") as PaymentMethod;

    const payload = await req.json().catch(async () => {
      // Try form data fallback
      const text = await req.text();
      try { return JSON.parse(text); } catch { return { raw: text }; }
    });

    const signature = req.headers.get("x-bkash-signature") || req.headers.get("x-sslcommerz-signature") || undefined;

    const gateway = getPaymentGateway(method);
    const result = await gateway.handleWebhook({ method, payload, signature });

    if (result.success && result.status === "PAID") {
      const db = readDB();
      // Find order by gatewayId or orderId in payload
      const orderId = payload.orderId || payload.merchantInvoiceNumber || payload.tran_id;
      if (orderId) {
        const order = db.orders.find(o => o.id === orderId || (o as any).gatewayId === result.gatewayId);
        if (order) {
          order.paymentStatus = "paid";
          order.status = "confirmed";
          (order as any).paidAt = new Date().toISOString();
          (order as any).gatewayId = result.gatewayId;
          writeDB(db);
          console.log(`[webhook] Order ${orderId} marked PAID via ${method} webhook`);
        }
      }
    }

    return NextResponse.json({ ok: true, status: result.status });
  } catch (e: any) {
    console.error("[webhook] error", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ message: "Webhook endpoint - POST only, requires gateway signature verification" });
}

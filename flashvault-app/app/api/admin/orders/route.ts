import { NextResponse } from "next/server";
import { readDB, writeDB } from "@/lib/db";
import { verifyAdminRequest } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";

export async function GET(req: Request) {
  const auth = verifyAdminRequest(req);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = readDB();
  return NextResponse.json({ orders: db.orders.slice(-100).reverse() });
}

export async function PATCH(req: Request) {
  const auth = verifyAdminRequest(req);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { id, status } = body;
    const db = readDB();
    const order = db.orders.find(o => o.id === id);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const oldStatus = order.status;
    order.status = status;
    order.updatedAt = Date.now();

    // Map order status to delivery/payment
    if (status === "shipped") {
      order.deliveryStatus = "shipped";
    } else if (status === "delivered") {
      order.deliveryStatus = "delivered";
      order.deliveredAt = Date.now();
    } else if (status === "payout_released") {
      order.payoutReleasedAt = Date.now();
      // Update merchant payout
      const product = db.products.find(p => p.id === order.productId);
      if (product) {
        const merchant = db.merchants.find(m => m.id === product.merchantId);
        if (merchant) {
          merchant.payoutBalance -= order.merchantEarning;
          merchant.totalPayouts += order.merchantEarning;
        }
      }
    } else if (status === "cancelled" || status === "refunded") {
      // Restore inventory
      const product = db.products.find(p => p.id === order.productId);
      if (product) {
        product.availableQuantity += order.quantity;
        product.soldQuantity -= order.quantity;
        product.sold -= order.quantity;
        if (product.status === "soldout" && product.availableQuantity > 0) {
          product.status = "live";
        }
      }
    }

    const ip = req.headers.get("x-forwarded-for") || "anon";
    db.auditLogs.push(createAuditLog("ORDER_STATUS_CHANGE", auth.role || "ADMIN", auth.role || "ADMIN", "ORDER", order.id, { oldStatus, newStatus: status }, ip));
    writeDB(db);
    return NextResponse.json({ ok: true, order });
  } catch (e) {
    console.error("[admin/orders] error", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

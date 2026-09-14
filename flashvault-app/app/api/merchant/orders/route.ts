import { NextResponse } from "next/server";
import { verifyUserRequest } from "@/lib/auth";
import { readDB } from "@/lib/db";

// Merchant orders - own data only

export async function GET(req: Request) {
  const auth = verifyUserRequest(req, ["MERCHANT"]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  const db = readDB();
  const merchantId = auth.user.merchantId;
  if (!merchantId) return NextResponse.json({ error: "Merchant profile not found" }, { status: 404 });

  // Get products of this merchant
  const myProductIds = new Set(db.products.filter(p => p.merchantId === merchantId).map(p => p.id));

  const myOrders = db.orders.filter(o => myProductIds.has(o.productId)).sort((a, b) => b.createdAt - a.createdAt);

  const stats = {
    totalOrders: myOrders.length,
    totalSales: myOrders.reduce((s, o) => s + o.amount, 0),
    totalCommission: myOrders.reduce((s, o) => s + (o.commission || 0), 0),
    totalEarnings: myOrders.reduce((s, o) => s + (o.merchantEarning || o.amount - (o.commission || 0)), 0),
    pendingDelivery: myOrders.filter(o => o.deliveryStatus === "processing").length,
    shipped: myOrders.filter(o => o.deliveryStatus === "shipped").length,
    delivered: myOrders.filter(o => o.deliveryStatus === "delivered").length,
  };

  return NextResponse.json({ orders: myOrders, stats });
}

import { NextResponse } from "next/server";
import { verifyUserRequest } from "@/lib/auth";
import { readDB } from "@/lib/db";

export async function GET(req: Request) {
  const auth = verifyUserRequest(req, ["MERCHANT"]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  const db = readDB();
  const merchantId = auth.user.merchantId;
  if (!merchantId) return NextResponse.json({ error: "Merchant profile not found" }, { status: 404 });

  const merchant = db.merchants.find(m => m.id === merchantId);
  if (!merchant) return NextResponse.json({ error: "Merchant not found" }, { status: 404 });

  const myProductIds = new Set(db.products.filter(p => p.merchantId === merchantId).map(p => p.id));
  const myOrders = db.orders.filter(o => myProductIds.has(o.productId));

  const totalSales = myOrders.reduce((s, o) => s + o.amount, 0);
  const totalCommission = myOrders.reduce((s, o) => s + (o.commission || Math.round(o.amount * 0.1)), 0);
  const totalEarnings = myOrders.reduce((s, o) => s + (o.merchantEarning || o.amount - (o.commission || Math.round(o.amount * 0.1))), 0);

  // Payout logic: 80% of earnings after delivery? For demo, simple
  const deliveredEarnings = myOrders.filter(o => o.deliveryStatus === "delivered").reduce((s, o) => s + (o.merchantEarning || 0), 0);
  const pendingEarnings = totalEarnings - deliveredEarnings;

  return NextResponse.json({
    merchant: {
      id: merchant.id,
      brand: merchant.brand,
      status: merchant.status,
      totalSales: merchant.totalSales,
      totalOrders: merchant.totalOrders,
      payoutBalance: merchant.payoutBalance || 0,
      totalPayouts: merchant.totalPayouts || 0,
    },
    earnings: {
      totalSales,
      totalCommission,
      totalEarnings,
      deliveredEarnings,
      pendingEarnings,
      payoutBalance: merchant.payoutBalance || deliveredEarnings, // Available for payout
      commissionPercent: db.settings.commissionPercent || 10,
    },
    orders: myOrders.length,
    payoutHistory: (merchant as any).payoutHistory || [],
  });
}

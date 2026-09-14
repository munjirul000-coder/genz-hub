import { NextResponse } from "next/server";
import { readDB, getRealStats } from "@/lib/db";
import { verifyAdminRequest } from "@/lib/auth";
import { computeDropState } from "@/lib/drop-engine";

export async function GET(req: Request) {
  const auth = verifyAdminRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error || "Unauthorized - Admin key required" }, { status: 401 });
  }

  try {
    const db = readDB();
    const stats = getRealStats();
    const computed = computeDropState(db.settings, db.drop, db.drops);

    // Real data only - no fake stats
    const pending = db.products.filter(p => p.status === "pending");
    const approved = db.products.filter(p => p.status === "approved" || p.status === "live");
    const rejected = db.products.filter(p => p.status === "rejected");
    const suspended = db.products.filter(p => p.status === "suspended");

    const merchants = db.merchants.map(m => ({
      ...m,
      // Don't expose sensitive
      email: m.email ? m.email.slice(0, 3) + "***" : "",
    }));

    const recentOrders = db.orders.slice(-20).reverse();
    const recentAudit = db.auditLogs.slice(-50).reverse();

    return NextResponse.json({
      // Real overview
      totalGross: stats.totalSales,
      commission: stats.platformRevenue,
      merchantEarnings: stats.merchantEarnings,
      liveTraffic: db.drop.liveTraffic,
      drop: {
        ...db.drop,
        computed,
      },
      stats: {
        totalProducts: stats.totalProducts,
        liveProducts: stats.liveProducts,
        pendingProducts: stats.pendingProducts,
        approvedProducts: stats.approvedProducts,
        rejectedProducts: stats.rejectedProducts,
        totalOrders: stats.totalOrders,
        completedOrders: stats.completedOrders,
        cancelledOrders: stats.cancelledOrders,
        totalMerchants: stats.totalMerchants,
        verifiedMerchants: stats.verifiedMerchants,
        avgDiscount: stats.avgDiscount,
        totalStock: stats.totalStock,
        totalSold: stats.totalSold,
      },
      pending,
      approved,
      rejected,
      suspended,
      orders: recentOrders,
      merchants: db.merchants, // full for admin
      products: db.products,
      auditLogs: recentAudit,
      drops: db.drops,
      settings: db.settings,
    }, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (e) {
    console.error("[api/admin/stats] error", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

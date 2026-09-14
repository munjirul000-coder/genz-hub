import { NextResponse } from "next/server";
import { verifyUserRequest } from "@/lib/auth";
import { readDB } from "@/lib/db";

export async function GET(req: Request) {
  const auth = verifyUserRequest(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error || "Not authenticated" }, { status: 401 });

  const db = readDB();
  const user = auth.user;

  // Phase 9: Order history via customerId not phone, own only, display IDs/statuses/tracking
  const myOrders = db.orders.filter(o => {
    const oAny = o as any;
    if (oAny.customerId === user.id) return true;
    if (!oAny.customerId && user.phone && o.customerPhone === user.phone) return true;
    return false;
  });

  myOrders.sort((a, b) => b.createdAt - a.createdAt);

  const enriched = myOrders.map(o => {
    const product = db.products.find(p => p.id === o.productId);
    return {
      id: o.id,
      orderId: o.id,
      productId: o.productId,
      productTitle: o.productTitle,
      productImage: product?.image || product?.images?.[0] || null,
      productBrand: product?.brand || null,
      quantity: o.quantity,
      amount: o.amount,
      deliveryFee: o.deliveryFee,
      totalAmount: o.totalAmount,
      commission: (o as any).commission,
      status: o.status,
      paymentStatus: o.paymentStatus,
      deliveryStatus: o.deliveryStatus,
      paymentMethod: (o as any).paymentMethod || "cod",
      courierTracking: (o as any).courierTracking || o.id,
      courierName: (o as any).courierName || "Pathao",
      trackingId: (o as any).courierTracking || `FV-${o.id.slice(-6).toUpperCase()}`,
      shippingAddress: o.shippingAddress,
      city: o.city,
      area: o.area,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
      paidAt: (o as any).paidAt || null,
      deliveredAt: (o as any).deliveredAt || null,
    };
  });

  return NextResponse.json({ orders: enriched, count: enriched.length, message: "Orders filtered by customerId ownership - server-enforced" });
}

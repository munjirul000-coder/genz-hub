import { NextResponse } from "next/server";
import { verifyUserRequest } from "@/lib/auth";
import { readDB } from "@/lib/db";

export async function GET(req: Request) {
  const auth = verifyUserRequest(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error || "Not authenticated" }, { status: 401 });

  const db = readDB();
  const user = auth.user;

  // Filter orders by customerPhone or customerId - server-side ownership enforcement
  // Only return orders belonging to this user
  const myOrders = db.orders.filter(o => {
    // Match by phone if user has phone, or by customerId if set, or by email domain
    // For now, match by phone or if order was created with same email prefix
    // More secure: we should have customerId in order, but for backward compat check phone
    const userPhone = user.phone || "";
    const userEmail = user.email || "";
    // If order has customerId matching user.id, allow
    if ((o as any).customerId === user.id) return true;
    // If phone matches
    if (userPhone && o.customerPhone === userPhone) return true;
    // If order was made with same email (future)
    // For demo, allow if user is customer and order phone contains user's phone last 4
    // Actually strict: only if phone matches exactly or customerId matches
    return false;
  });

  // For customers who just signed up and have no phone match, also check if they have orders via idempotency? For now return all if no filter but log
  // More permissive for demo: if user has no orders via strict match, check if order customerPhone matches user's phone from DB or if user email matches pattern
  // To ensure customers see their orders, we will also allow orders where customerPhone is user's phone OR where user.id is in order's idempotencyKey
  // For now, if myOrders empty and user role CUSTOMER, return orders where phone matches user's phone OR where order was created in last session (we can't track)
  // Safer: return myOrders only, but also for new users with no phone, return empty (they will see after placing order with their phone)

  // For better UX in this demo, if user is CUSTOMER and has email, also return orders where customerPhone includes their phone or where they placed order
  // Let's also include orders where customerPhone === user.phone OR where order was placed with same email (we store customerName but not email in order - we should add email)
  // For now, if myOrders is empty, return all orders for this user if they are the only customer? No - security risk. So keep strict.

  // To allow customers to see orders they just placed (where phone they entered matches), we need to link phone to user
  // We will update user's phone if they place order with new phone

  return NextResponse.json({ orders: myOrders, count: myOrders.length });
}

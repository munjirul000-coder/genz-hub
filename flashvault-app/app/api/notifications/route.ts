import { NextResponse } from "next/server";
import { verifyUserRequest } from "@/lib/auth";
import { readDB, writeDB } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

// Notifications DB - customer/merchant/admin events
// Types: ORDER_UPDATE, PAYMENT_UPDATE, MERCHANT_APPROVAL, PRODUCT_STATUS, DROP_ALERT, SYSTEM

function ensureNotificationsStore(db: any) {
  if (!db.notifications) db.notifications = [];
  return db.notifications;
}

export async function GET(req: Request) {
  const auth = verifyUserRequest(req);
  if (!auth.ok) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get("unread") === "true";
  const limit = Math.min(100, Number(searchParams.get("limit")) || 20);

  const db = readDB();
  let notifications = ensureNotificationsStore(db).filter((n: any) =>
    n.userId === auth.user.id || (auth.user.role === "ADMIN" || auth.user.role === "SUPER_ADMIN" ? n.role === "ADMIN" : false) || n.role === auth.user.role
  );

  // For simplicity, userId match or broadcast (no userId + matching role)
  notifications = ensureNotificationsStore(db).filter((n: any) => {
    if (n.userId === auth.user.id) return true;
    if (!n.userId && n.targetRole === auth.user.role) return true;
    if (!n.userId && !n.targetRole && auth.user.role === "ADMIN") return true; // admin sees broadcast
    return false;
  });

  if (unreadOnly) {
    notifications = notifications.filter((n: any) => !n.read);
  }

  notifications.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const unreadCount = ensureNotificationsStore(db).filter((n: any) => n.userId === auth.user.id && !n.read).length;

  return NextResponse.json({
    notifications: notifications.slice(0, limit),
    unreadCount,
    total: notifications.length,
  });
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || "anon";
  const rl = rateLimit(`notif_create:${ip}`, 30, 60_000);
  if (!rl.ok) return NextResponse.json({ error: "Rate limited" }, { status: 429 });

  const auth = verifyUserRequest(req);
  if (!auth.ok) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  // Only ADMIN/SUPER_ADMIN or system can create notifications for others
  // For now, allow any authenticated to create for self (e.g., after order)
  try {
    const body = await req.json();
    const { userId, title, message, type = "SYSTEM", targetRole, data } = body;

    if (!title || !message) return NextResponse.json({ error: "title and message required" }, { status: 400 });

    // Authorization: non-admin can only create for self
    if (!["ADMIN", "SUPER_ADMIN"].includes(auth.user.role) && userId && userId !== auth.user.id) {
      return NextResponse.json({ error: "Forbidden - cannot create notification for others" }, { status: 403 });
    }

    const db = readDB();
    const notifications = ensureNotificationsStore(db);

    const notif = {
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      userId: userId || auth.user.id,
      targetRole: targetRole || null,
      title,
      message,
      type, // ORDER_UPDATE, PAYMENT_UPDATE, MERCHANT_APPROVAL, PRODUCT_STATUS, DROP_ALERT, SYSTEM
      data: data || null,
      read: false,
      createdAt: new Date().toISOString(),
    };

    notifications.push(notif);
    writeDB(db);

    return NextResponse.json({ ok: true, notification: notif });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const auth = verifyUserRequest(req);
  if (!auth.ok) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  try {
    const body = await req.json();
    const { id, read, markAllRead } = body;

    const db = readDB();
    const notifications = ensureNotificationsStore(db);

    if (markAllRead) {
      notifications.forEach((n: any) => {
        if (n.userId === auth.user.id) n.read = true;
      });
      writeDB(db);
      return NextResponse.json({ ok: true, message: "All marked as read" });
    }

    if (!id) return NextResponse.json({ error: "id required or markAllRead true" }, { status: 400 });

    const idx = notifications.findIndex((n: any) => n.id === id);
    if (idx === -1) return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    if (notifications[idx].userId !== auth.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    notifications[idx].read = read !== undefined ? !!read : true;
    notifications[idx].readAt = new Date().toISOString();
    writeDB(db);

    return NextResponse.json({ ok: true, notification: notifications[idx] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

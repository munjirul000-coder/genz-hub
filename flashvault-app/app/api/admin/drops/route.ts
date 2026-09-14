import { NextResponse } from "next/server";
import { readDB, writeDB } from "@/lib/db";
import { verifyAdminRequest } from "@/lib/auth";
import { dropCreateSchema } from "@/lib/validators";
import { createAuditLog } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(req: Request) {
  const auth = verifyAdminRequest(req);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = readDB();
  return NextResponse.json({ drops: db.drops, settings: db.settings });
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || "anon";
  const rl = rateLimit(`admin:drops:${ip}`, 20, 60_000);
  if (!rl.ok) return NextResponse.json({ error: "Rate limited" }, { status: 429 });

  const auth = verifyAdminRequest(req);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = dropCreateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

    const db = readDB();
    const newDrop = {
      id: "drop_" + Date.now(),
      title: parsed.data.title,
      scheduledAt: parsed.data.scheduledAt,
      durationMinutes: parsed.data.durationMinutes,
      status: "UPCOMING" as const,
      productIds: parsed.data.productIds,
      createdAt: Date.now(),
      createdBy: auth.role || "ADMIN",
    };

    db.drops.push(newDrop);

    // Assign products to drop
    parsed.data.productIds.forEach(pid => {
      const p = db.products.find(prod => prod.id === pid);
      if (p) {
        p.dropId = newDrop.id;
        p.updatedAt = Date.now();
      }
    });

    db.auditLogs.push(createAuditLog("CREATE_DROP", auth.role || "ADMIN", auth.role || "ADMIN", "DROP", newDrop.id, { title: newDrop.title, scheduledAt: newDrop.scheduledAt }, ip));
    if (db.auditLogs.length > 500) db.auditLogs = db.auditLogs.slice(-500);

    writeDB(db);
    return NextResponse.json({ ok: true, drop: newDrop });
  } catch (e) {
    console.error("[api/admin/drops] POST error", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const auth = verifyAdminRequest(req);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { id, status, productIds } = body;
    const db = readDB();
    const drop = db.drops.find(d => d.id === id);
    if (!drop) return NextResponse.json({ error: "Drop not found" }, { status: 404 });

    if (status) drop.status = status;
    if (productIds) drop.productIds = productIds;

    const ip = req.headers.get("x-forwarded-for") || "anon";
    db.auditLogs.push(createAuditLog("UPDATE_DROP", auth.role || "ADMIN", auth.role || "ADMIN", "DROP", drop.id, { status, productIds }, ip));
    writeDB(db);
    return NextResponse.json({ ok: true, drop });
  } catch (e) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

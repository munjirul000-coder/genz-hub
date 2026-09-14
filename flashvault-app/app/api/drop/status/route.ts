import { NextResponse } from "next/server";
import { readDB, writeDB } from "@/lib/db";
import { computeDropState } from "@/lib/drop-engine";
import { verifyAdminRequest } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(req: Request) {
  try {
    const db = readDB();
    const computed = computeDropState(db.settings, db.drop, db.drops);
    return NextResponse.json({
      drop: db.drop,
      computed,
      serverTime: Date.now(),
      settings: {
        timezone: db.settings.timezone,
        dropDay: db.settings.dropDay,
        dropStartHour: db.settings.dropStartHour,
        dropDuration: db.settings.dropDurationMinutes,
      }
    }, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (e) {
    return NextResponse.json({ error: "Failed to get drop status" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || "anon";
  const rl = rateLimit(`drop:toggle:${ip}`, 10, 60_000);
  if (!rl.ok) return NextResponse.json({ error: "Rate limited" }, { status: 429 });

  const auth = verifyAdminRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { isLocked, nextDropAt, forceLive } = body;

    const db = readDB();

    if (typeof isLocked === "boolean") {
      db.drop.isLocked = isLocked;
    }
    if (nextDropAt) {
      db.drop.nextDropAt = nextDropAt;
    }
    if (forceLive) {
      db.drop.isLocked = false;
    }

    // Audit log
    db.auditLogs.push(createAuditLog(
      "TOGGLE_DROP_LOCK",
      auth.role || "ADMIN",
      auth.role || "ADMIN",
      "DROP",
      db.drop.currentDropId || "global",
      { isLocked: db.drop.isLocked, nextDropAt: db.drop.nextDropAt },
      ip
    ));

    // Keep only last 500 logs
    if (db.auditLogs.length > 500) db.auditLogs = db.auditLogs.slice(-500);

    writeDB(db);

    const computed = computeDropState(db.settings, db.drop, db.drops);

    return NextResponse.json({ ok: true, drop: db.drop, computed });
  } catch (e) {
    console.error("[api/drop/status] error", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

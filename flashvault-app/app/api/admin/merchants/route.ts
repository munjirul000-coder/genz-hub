import { NextResponse } from "next/server";
import { readDB, writeDB } from "@/lib/db";
import { verifyAdminRequest } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";

export async function GET(req: Request) {
  const auth = verifyAdminRequest(req);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = readDB();
  return NextResponse.json({ merchants: db.merchants });
}

export async function POST(req: Request) {
  const auth = verifyAdminRequest(req);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { id, action, reason } = body;
    const db = readDB();
    const merchant = db.merchants.find(m => m.id === id);
    if (!merchant) return NextResponse.json({ error: "Merchant not found" }, { status: 404 });

    const ip = req.headers.get("x-forwarded-for") || "anon";
    let auditAction: any = "VERIFY_MERCHANT";

    if (action === "approve") {
      merchant.status = "approved";
      merchant.verified = true;
      merchant.updatedAt = Date.now();
      auditAction = "VERIFY_MERCHANT";
    } else if (action === "suspend") {
      merchant.status = "suspended";
      merchant.suspendedReason = reason || "Suspended by admin";
      merchant.updatedAt = Date.now();
      auditAction = "SUSPEND_MERCHANT";
    } else if (action === "reactivate") {
      merchant.status = "approved";
      merchant.updatedAt = Date.now();
      auditAction = "VERIFY_MERCHANT";
    }

    db.auditLogs.push(createAuditLog(auditAction, auth.role || "ADMIN", auth.role || "ADMIN", "MERCHANT", merchant.id, { action, reason }, ip));
    writeDB(db);
    return NextResponse.json({ ok: true, merchant });
  } catch (e) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

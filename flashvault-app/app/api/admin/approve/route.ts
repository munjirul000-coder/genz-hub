import { NextResponse } from "next/server";
import { readDB, writeDB } from "@/lib/db";
import { verifyAdminRequest } from "@/lib/auth";
import { approveActionSchema, calculateDiscountPercent } from "@/lib/validators";
import { createAuditLog } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || "anon";
  const rl = rateLimit(`admin:approve:${ip}`, 30, 60_000);
  if (!rl.ok) return NextResponse.json({ error: "Rate limited" }, { status: 429 });

  const auth = verifyAdminRequest(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = approveActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const { id, action, reason } = parsed.data;
    const db = readDB();
    const product = db.products.find(p => p.id === id);
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const oldStatus = product.status;
    let auditAction: any = "APPROVE_PRODUCT";

    switch (action) {
      case "approve":
        product.status = "approved";
        product.approvalStatus = "approved";
        product.verificationStatus = "verified";
        product.verifiedAt = Date.now();
        product.verifiedBy = auth.role || "ADMIN";
        product.updatedAt = Date.now();
        auditAction = "APPROVE_PRODUCT";
        break;
      case "reject":
        product.status = "rejected";
        product.approvalStatus = "rejected";
        product.rejectionReason = reason || "Does not meet quality standards";
        product.updatedAt = Date.now();
        auditAction = "REJECT_PRODUCT";
        break;
      case "live":
        product.status = "live";
        product.approvalStatus = "live";
        product.verificationStatus = "verified";
        product.updatedAt = Date.now();
        auditAction = "LIVE_PRODUCT";
        break;
      case "suspend":
        product.status = "suspended";
        product.approvalStatus = "suspended";
        product.rejectionReason = reason || "Suspended by admin";
        product.updatedAt = Date.now();
        auditAction = "SUSPEND_PRODUCT";
        break;
      case "remove":
        product.status = "rejected";
        product.approvalStatus = "rejected";
        product.updatedAt = Date.now();
        break;
    }

    // Recalculate discount server-side - never trust client
    product.discountPercent = calculateDiscountPercent(product.originalPrice, product.vaultPrice);

    // Audit log
    db.auditLogs.push(createAuditLog(
      auditAction,
      auth.role || "ADMIN",
      auth.role || "ADMIN",
      "PRODUCT",
      product.id,
      { oldStatus, newStatus: product.status, reason },
      ip
    ));
    if (db.auditLogs.length > 500) db.auditLogs = db.auditLogs.slice(-500);

    writeDB(db);

    return NextResponse.json({ ok: true, product, oldStatus, newStatus: product.status });
  } catch (e) {
    console.error("[api/admin/approve] error", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

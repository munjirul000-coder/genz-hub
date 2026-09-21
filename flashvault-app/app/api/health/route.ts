import { NextResponse } from "next/server";
import { getStorageConfig } from "@/lib/storage";
import { getPaymentConfig } from "@/lib/payment";
import { readDB } from "@/lib/db";
import { isPrismaEnabled } from "@/lib/prisma";

export async function GET() {
  const storage = getStorageConfig();
  const payments = getPaymentConfig();
  const db = readDB();
  const hasDbUrl = !!process.env.DATABASE_URL;
  const prismaEnabled = isPrismaEnabled();
  const hasJwtSecret = !!process.env.JWT_SECRET && process.env.JWT_SECRET !== "flashvault_jwt_secret_change_in_prod_2026_secure";
  const hasSuperAdminEnv = !!process.env.SUPER_ADMIN_PASSWORD;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";

  const checks = {
    database: {
      status: hasDbUrl ? (prismaEnabled ? "ok" : "warning") : "error",
      message: hasDbUrl 
        ? (prismaEnabled ? "Postgres configured with Prisma client" : "DATABASE_URL set but Prisma client not generated - run prisma generate")
        : "DATABASE_URL not set - using ephemeral JSON file, data will be lost on restart. Set DATABASE_URL from Supabase/Neon free tier.",
      hasDbUrl,
      prismaEnabled,
      users: db.users.length,
      products: db.products.length,
      orders: db.orders.length,
    },
    storage: {
      status: storage.usingLocal ? "error" : "ok",
      ...storage,
    },
    auth: {
      status: hasJwtSecret ? "ok" : "warning",
      message: hasJwtSecret ? "JWT_SECRET set" : "JWT_SECRET using default - set strong secret in production!",
      hasJwtSecret,
      hasSuperAdminEnv,
      superAdminEnvMessage: hasSuperAdminEnv ? "SUPER_ADMIN_PASSWORD set via env" : "SUPER_ADMIN_PASSWORD not set - using db.json fallback (ok for demo, set env for production)",
    },
    payments: {
      status: payments.bkash.configured || payments.sslcommerz.configured ? "ok" : "warning",
      paymentMessage: payments.bkash.configured || payments.sslcommerz.configured 
        ? "Payment gateway configured" 
        : "Payment gateways not configured - orders will be COD only. Set BKASH or SSLCOMMERZ env for real payments.",
      ...payments,
    },
    site: {
      status: siteUrl ? "ok" : "warning",
      siteUrl: siteUrl || "https://flashvault-bd.onrender.com (default)",
      message: siteUrl ? "NEXT_PUBLIC_SITE_URL set" : "NEXT_PUBLIC_SITE_URL not set - using default",
    },
  };

  const allOk = checks.database.status !== "error" && checks.storage.status !== "error";
  const warnings = Object.values(checks).filter((c: any) => c.status === "warning").length;
  const errors = Object.values(checks).filter((c: any) => c.status === "error").length;

  return NextResponse.json({
    ok: allOk,
    readyForRealUsers: allOk && errors === 0,
    summary: allOk 
      ? warnings > 0 ? `Ready for real users with ${warnings} warnings (COD only, etc)` : "100% ready for real users"
      : `NOT ready for real users - ${errors} critical issues must be fixed (database, storage)`,
    checks,
    realUserChecklist: {
      "1. Database persistent (Supabase/Neon)": checks.database.status !== "error" ? "✓" : "✗ FIX NEEDED - Set DATABASE_URL",
      "2. Image storage persistent (Cloudinary/R2)": checks.storage.status !== "error" ? "✓" : "✗ FIX NEEDED - Set CLOUDINARY_CLOUD_NAME + CLOUDINARY_UPLOAD_PRESET",
      "3. JWT secret strong": checks.auth.status === "ok" ? "✓" : "⚠ Set JWT_SECRET",
      "4. Super admin via env": checks.auth.hasSuperAdminEnv ? "✓" : "⚠ Set SUPER_ADMIN_PASSWORD for production",
      "5. Payment gateway (optional)": checks.payments.status === "ok" ? "✓ Configured" : "⚠ COD only - set BKASH or SSLCOMMERZ for real payments",
      "6. Site URL": checks.site.status === "ok" ? "✓" : "⚠ Set NEXT_PUBLIC_SITE_URL",
    },
    studentBudgetTip: "For 1000 Tk/month budget: Use Vercel FREE + Supabase FREE + Cloudinary FREE + R2 FREE = 0 Tk/month. Domain ৳1200/year. See .env.example",
  });
}

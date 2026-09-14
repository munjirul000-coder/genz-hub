import { NextResponse } from "next/server";
import { createSuperAdminIfNotExists } from "@/lib/auth-system";
import { readDB } from "@/lib/db";

export async function POST() {
  try {
    const db = readDB();
    const hasSuper = db.users.some(u => u.role === "SUPER_ADMIN" && u.passwordHash);
    if (hasSuper) {
      return NextResponse.json({ ok: false, message: "Super admin already exists - not creating" }, { status: 400 });
    }

    await createSuperAdminIfNotExists();
    const db2 = readDB();
    const superAdmins = db2.users.filter(u => u.role === "SUPER_ADMIN").map(u => ({ id: u.id, email: u.email, name: u.name, createdAt: u.createdAt }));
    return NextResponse.json({ ok: true, message: "Super admin creation attempted - check server logs. Set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD env vars.", superAdmins });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function GET() {
  const db = readDB();
  const superAdmins = db.users.filter(u => u.role === "SUPER_ADMIN").map(u => ({ id: u.id, email: u.email, name: u.name, createdAt: u.createdAt, hasPassword: !!(u as any).passwordHash }));
  return NextResponse.json({ superAdmins, count: superAdmins.length, envSet: !!process.env.SUPER_ADMIN_PASSWORD });
}

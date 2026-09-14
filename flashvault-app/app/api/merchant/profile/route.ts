import { NextResponse } from "next/server";
import { verifyUserRequest } from "@/lib/auth";
import { readDB, writeDB } from "@/lib/db";

export async function GET(req: Request) {
  const auth = verifyUserRequest(req, ["MERCHANT"]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  const db = readDB();
  const merchant = db.merchants.find(m => m.id === auth.user.merchantId);
  if (!merchant) return NextResponse.json({ error: "Merchant not found" }, { status: 404 });

  return NextResponse.json({ merchant, user: { id: auth.user.id, name: auth.user.name, email: auth.user.email, phone: auth.user.phone, role: auth.user.role } });
}

export async function PUT(req: Request) {
  const auth = verifyUserRequest(req, ["MERCHANT"]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const body = await req.json();
    const { brand, name, phone, businessInfo } = body;

    const db = readDB();
    const merchant = db.merchants.find(m => m.id === auth.user.merchantId);
    if (!merchant) return NextResponse.json({ error: "Merchant not found" }, { status: 404 });

    if (brand) merchant.brand = brand;
    if (businessInfo) (merchant as any).businessInfo = businessInfo;
    merchant.updatedAt = Date.now();

    const user = db.users.find(u => u.id === auth.user.id);
    if (user) {
      if (name) (user as any).name = name;
      if (phone) (user as any).phone = phone;
      (user as any).updatedAt = Date.now();
    }

    writeDB(db);

    return NextResponse.json({ ok: true, merchant, user });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

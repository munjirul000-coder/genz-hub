import { NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/auth-system";
import { readDB } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { user, error } = getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ user: null, error: error || "Not authenticated" }, { status: 401 });
    }
    const db = readDB();
    const fullUser = db.users.find(u => u.id === user.id);
    if (!fullUser) return NextResponse.json({ user: null }, { status: 401 });

    const { passwordHash, ...safe } = fullUser as any;
    // Include merchant if applicable
    let merchant = null;
    if (fullUser.merchantId) {
      merchant = db.merchants.find(m => m.id === fullUser.merchantId);
    }

    return NextResponse.json({ user: { ...safe, merchant } });
  } catch (e) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

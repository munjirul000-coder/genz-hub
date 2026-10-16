import { NextResponse } from "next/server";
import { readDB, writeDB } from "@/lib/db";
import { dbMutex } from "@/lib/store";
import { rateLimit } from "@/lib/rate-limit";

// GET /api/auth/verify-email?token=xxx — email verification link handler
export async function GET(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || "anon";
  const rl = rateLimit(`verify:${ip}`, 20, 60_000);
  if (!rl.ok) return NextResponse.redirect(new URL("/verify-email?status=rate", req.url), 303);

  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token || token.length < 10) {
    return NextResponse.redirect(new URL("/verify-email?status=invalid", req.url), 303);
  }

  const release = await dbMutex.acquire();
  try {
    const db = readDB();
    const user = (db.users as any[]).find(u => u.emailVerifyToken === token);

    if (!user) {
      return NextResponse.redirect(new URL("/verify-email?status=invalid", req.url), 303);
    }
    if (user.emailVerifyExpires && Date.now() > user.emailVerifyExpires) {
      return NextResponse.redirect(new URL("/verify-email?status=expired", req.url), 303);
    }

    user.emailVerified = true;
    user.emailVerifyToken = undefined;
    user.emailVerifyExpires = undefined;
    writeDB(db);

    return NextResponse.redirect(new URL("/verify-email?status=ok", req.url), 303);
  } catch (e) {
    console.error("[verify-email] error", e);
    return NextResponse.redirect(new URL("/verify-email?status=error", req.url), 303);
  } finally {
    release();
  }
}

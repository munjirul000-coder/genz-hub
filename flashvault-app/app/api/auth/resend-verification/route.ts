import { NextResponse } from "next/server";
import { readDB, writeDB } from "@/lib/db";
import { verifyUserRequest } from "@/lib/auth";
import { sendEmail, verificationEmailHtml, isEmailConfigured } from "@/lib/mailer";
import { rateLimit } from "@/lib/rate-limit";
import crypto from "crypto";

// POST /api/auth/resend-verification — logged-in user requests a fresh verification email
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || "anon";
  const rl = rateLimit(`resend:${ip}`, 3, 10 * 60_000); // max 3 per 10 min
  if (!rl.ok) return NextResponse.json({ error: "Too many requests. Try again in 10 minutes." }, { status: 429 });

  const auth = verifyUserRequest(req);
  if (!auth.ok) return NextResponse.json({ error: "Login required" }, { status: 401 });

  try {
    const db = readDB();
    const user: any = db.users.find(u => u.id === auth.user!.id);
    if (!user) return NextResponse.json({ error: "Account not found" }, { status: 404 });
    if (user.emailVerified) return NextResponse.json({ ok: true, alreadyVerified: true });
    if (!user.email) return NextResponse.json({ error: "No email on account" }, { status: 400 });

    if (!isEmailConfigured()) {
      return NextResponse.json({ error: "Email sending not configured on server yet. Contact support." }, { status: 503 });
    }

    user.emailVerifyToken = crypto.randomBytes(24).toString("hex");
    user.emailVerifyExpires = Date.now() + 24 * 60 * 60 * 1000;
    writeDB(db);

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://flashvault-bd.onrender.com";
    const link = `${siteUrl}/api/auth/verify-email?token=${user.emailVerifyToken}`;
    const sent = await sendEmail(user.email, "Verify your FlashVault account", verificationEmailHtml(user.name, link));

    return NextResponse.json({ ok: sent, message: sent ? "Verification email sent — check your inbox (and spam folder)." : "Could not send email right now." });
  } catch (e: any) {
    console.error("[resend-verification] error", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

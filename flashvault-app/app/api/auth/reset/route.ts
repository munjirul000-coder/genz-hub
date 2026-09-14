import { NextResponse } from "next/server";
import { resetPassword } from "@/lib/auth-system";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || "anon";
  const rl = rateLimit(`reset:${ip}`, 5, 60_000);
  if (!rl.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  try {
    const { token, newPassword, confirmPassword } = await req.json();
    if (!token || !newPassword) return NextResponse.json({ error: "Token and new password required" }, { status: 400 });
    if (newPassword !== confirmPassword) return NextResponse.json({ error: "Passwords do not match" }, { status: 400 });

    const result = await resetPassword(token, newPassword);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status || 400 });

    return NextResponse.json({ ok: true, message: "Password reset successful. Please login." });
  } catch (e) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

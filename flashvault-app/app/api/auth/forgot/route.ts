import { NextResponse } from "next/server";
import { generateResetToken } from "@/lib/auth-system";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || "anon";
  const rl = rateLimit(`forgot:${ip}`, 5, 60_000);
  if (!rl.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });
    const result = await generateResetToken(email);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status || 400 });

    // In production, send email. For dev, return token
    return NextResponse.json({
      ok: true,
      message: "Reset token generated. In production this would be emailed.",
      resetToken: result.token, // Remove in prod, keep for demo
    });
  } catch (e) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

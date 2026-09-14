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
    
    // Secure flow: never return token, always generic message, prevent enumeration
    // Log token server-side only, in production would email
    if (result.ok && result.token) {
      console.log(`[forgot-password] Reset token for ${email}: ${result.token} - In prod, email this, never return to client`);
    }

    // Always return generic message regardless of whether email exists
    return NextResponse.json({
      ok: true,
      message: "If an account exists with that email, a reset link has been sent. Check your email. Token logged server-side only for demo.",
    });
  } catch (e) {
    // Even on error, return generic message to prevent enumeration
    return NextResponse.json({
      ok: true,
      message: "If an account exists with that email, a reset link has been sent.",
    });
  }
}

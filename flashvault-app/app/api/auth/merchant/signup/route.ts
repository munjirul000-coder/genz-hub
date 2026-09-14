import { NextResponse } from "next/server";
import { signupMerchant } from "@/lib/auth-system";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || "anon";
  const rl = rateLimit(`m_signup:${ip}`, 5, 60_000);
  if (!rl.ok) return NextResponse.json({ error: "Too many attempts" }, { status: 429 });

  try {
    const body = await req.json();
    const { name, brand, email, phone, password, confirmPassword, businessInfo } = body;
    if (password !== confirmPassword) return NextResponse.json({ error: "Passwords do not match" }, { status: 400 });

    const result = await signupMerchant({ name, brand, email, phone, password, businessInfo });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status || 400 });

    const res = NextResponse.json({ ok: true, user: result.user, message: "Merchant account pending approval" });
    res.cookies.set("fv_token", result.token!, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });
    return res;
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

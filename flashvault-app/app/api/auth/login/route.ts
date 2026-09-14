import { NextResponse } from "next/server";
import { loginCustomer } from "@/lib/auth-system";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || "anon";
  const rl = rateLimit(`login:${ip}`, 10, 60_000);
  if (!rl.ok) return NextResponse.json({ error: "Too many login attempts. Wait 1 minute." }, { status: 429 });

  try {
    const body = await req.json();
    const { email, password } = body;
    const result = await loginCustomer(email, password);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status || 400 });

    const res = NextResponse.json({ ok: true, user: result.user });
    res.cookies.set("fv_token", result.token!, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });
    return res;
  } catch (e) {
    console.error("[login] error", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

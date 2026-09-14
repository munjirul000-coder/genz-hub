import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ ok: true, message: "Logged out" });
  res.cookies.set("fv_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  // Also clear admin key cookie if any
  res.cookies.set("fv_admin_key", "", { maxAge: 0, path: "/" });
  return res;
}

export async function GET() {
  return POST();
}

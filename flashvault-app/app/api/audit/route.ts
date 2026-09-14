import { NextResponse } from "next/server";
import { verifyUserRequest } from "@/lib/auth";
import { getAuditLogs } from "@/lib/audit";

export async function GET(req: Request) {
  const auth = verifyUserRequest(req, ["ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return NextResponse.json({ error: "Forbidden - Admin only" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId") || undefined;
  const action = searchParams.get("action") || undefined;
  const limit = Number(searchParams.get("limit")) || 100;

  const logs = getAuditLogs({ userId, action, limit });

  return NextResponse.json({ logs, count: logs.length });
}

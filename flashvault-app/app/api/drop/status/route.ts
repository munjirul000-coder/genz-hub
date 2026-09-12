import { NextResponse } from "next/server";
import { readDB, writeDB } from "@/lib/db";

export async function GET() {
  const db = readDB();
  return NextResponse.json({ drop: db.drop });
}

export async function POST(req: Request) {
  const { isLocked } = await req.json();
  const db = readDB();
  db.drop.isLocked = !!isLocked;
  writeDB(db);
  return NextResponse.json({ ok: true, drop: db.drop });
}

import { NextResponse } from "next/server";
import { readDB } from "@/lib/db";

export async function GET() {
  const db = readDB();
  // simulate live traffic jitter
  db.drop.liveTraffic = 14230 + Math.floor(Math.random() * 800) - 400;
  return NextResponse.json({ products: db.products, drop: db.drop });
}

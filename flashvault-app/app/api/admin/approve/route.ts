import { NextResponse } from "next/server";
import { readDB, writeDB } from "@/lib/db";

export async function POST(req: Request) {
  const body = await req.json();
  const { id, action } = body;
  const db = readDB();
  const p = db.products.find((x) => x.id === id);
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (action === "approve") p.status = "approved";
  else if (action === "reject") p.status = "rejected";
  else if (action === "live") p.status = "live";
  writeDB(db);
  return NextResponse.json({ ok: true, product: p });
}

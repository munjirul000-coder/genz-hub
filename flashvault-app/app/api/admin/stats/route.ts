import { NextResponse } from "next/server";
import { readDB } from "@/lib/db";

export async function GET() {
  const db = readDB();
  const totalGross = db.orders.reduce((s, o) => s + o.amount, 0) + db.drop.totalGross;
  const commission = Math.round(totalGross * 0.1);
  return NextResponse.json({
    totalGross,
    commission,
    liveTraffic: db.drop.liveTraffic + Math.floor(Math.random() * 400),
    drop: db.drop,
    pending: db.products.filter((p) => p.status === "pending"),
    orders: db.orders,
    products: db.products,
  });
}

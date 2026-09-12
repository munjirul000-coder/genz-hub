import { NextResponse } from "next/server";
import { readDB, writeDB } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  brand: z.string().min(2),
  title: z.string().min(4),
  originalPrice: z.number().min(100),
  vaultPrice: z.number().min(100),
  stock: z.number().min(1),
  category: z.string().min(2),
  merchantName: z.string().min(2),
  phone: z.string().min(11),
});

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const db = readDB();
  const p = parsed.data;
  const newProduct = {
    id: "p" + Date.now(),
    brand: p.brand,
    title: p.title,
    originalPrice: p.originalPrice,
    vaultPrice: p.vaultPrice,
    stock: p.stock,
    sold: 0,
    image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&h=750&fit=crop",
    category: p.category,
    status: "pending" as const,
    merchantId: "m" + Date.now(),
    createdAt: Date.now(),
  };
  db.products.push(newProduct);
  db.merchants.push({
    id: newProduct.merchantId,
    name: p.merchantName,
    brand: p.brand,
    phone: p.phone,
    email: "",
    verified: false,
    totalSales: 0,
    createdAt: Date.now(),
  });
  writeDB(db);
  return NextResponse.json({ ok: true, product: newProduct });
}

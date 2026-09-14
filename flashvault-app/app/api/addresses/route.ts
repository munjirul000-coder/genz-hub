import { NextResponse } from "next/server";
import { verifyUserRequest } from "@/lib/auth";
import { readDB, writeDB } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

// Addresses DB CRUD - server-side ownership, BD fields
// BD fields: division, district, upazila, fullAddress, phone, label

function ensureAddressStore(db: any) {
  if (!db.addresses) db.addresses = [];
  return db.addresses;
}

export async function GET(req: Request) {
  const auth = verifyUserRequest(req);
  if (!auth.ok) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  const db = readDB();
  const addresses = ensureAddressStore(db).filter((a: any) => a.userId === auth.user.id);
  return NextResponse.json({ addresses });
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || "anon";
  const rl = rateLimit(`addr_create:${ip}`, 20, 60_000);
  if (!rl.ok) return NextResponse.json({ error: "Rate limited" }, { status: 429 });

  const auth = verifyUserRequest(req);
  if (!auth.ok) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  try {
    const body = await req.json();
    const { label, fullName, phone, division, district, upazila, fullAddress, postalCode, isDefault } = body;

    if (!fullName || !phone || !division || !district || !fullAddress) {
      return NextResponse.json({ error: "Required: fullName, phone, division, district, fullAddress" }, { status: 400 });
    }

    // Validate BD phone
    const bdPhoneRegex = /^(\+880|880|0)?1[3-9]\d{8}$/;
    if (!bdPhoneRegex.test(phone.replace(/\s/g, ""))) {
      return NextResponse.json({ error: "Invalid BD phone number" }, { status: 400 });
    }

    const db = readDB();
    const addresses = ensureAddressStore(db);

    // If setting default, unset others
    if (isDefault) {
      addresses.forEach((a: any) => {
        if (a.userId === auth.user.id) a.isDefault = false;
      });
    }

    const newAddr = {
      id: `addr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      userId: auth.user.id,
      label: label || "Home",
      fullName,
      phone,
      division,
      district,
      upazila: upazila || "",
      fullAddress,
      postalCode: postalCode || "",
      isDefault: !!isDefault || addresses.filter((a: any) => a.userId === auth.user.id).length === 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    addresses.push(newAddr);
    writeDB(db);

    return NextResponse.json({ ok: true, address: newAddr });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const auth = verifyUserRequest(req);
  if (!auth.ok) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  try {
    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const db = readDB();
    const addresses = ensureAddressStore(db);
    const idx = addresses.findIndex((a: any) => a.id === id);

    if (idx === -1) return NextResponse.json({ error: "Address not found" }, { status: 404 });
    if (addresses[idx].userId !== auth.user.id) return NextResponse.json({ error: "Forbidden - not your address" }, { status: 403 });

    if (updates.isDefault) {
      addresses.forEach((a: any) => {
        if (a.userId === auth.user.id) a.isDefault = false;
      });
    }

    addresses[idx] = { ...addresses[idx], ...updates, id: addresses[idx].id, userId: auth.user.id, updatedAt: new Date().toISOString() };
    writeDB(db);

    return NextResponse.json({ ok: true, address: addresses[idx] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const auth = verifyUserRequest(req);
  if (!auth.ok) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const db = readDB();
    const addresses = ensureAddressStore(db);
    const idx = addresses.findIndex((a: any) => a.id === id);

    if (idx === -1) return NextResponse.json({ error: "Address not found" }, { status: 404 });
    if (addresses[idx].userId !== auth.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const wasDefault = addresses[idx].isDefault;
    addresses.splice(idx, 1);

    // If deleted was default, make first remaining default
    if (wasDefault) {
      const remaining = addresses.filter((a: any) => a.userId === auth.user.id);
      if (remaining.length > 0) remaining[0].isDefault = true;
    }

    writeDB(db);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

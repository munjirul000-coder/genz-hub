import { NextResponse } from "next/server";
import { verifyUserRequest } from "@/lib/auth";
import { uploadImage, validateImageFile, getStorageConfig } from "@/lib/storage";
import { rateLimit } from "@/lib/rate-limit";

export async function GET() {
  return NextResponse.json({
    storage: getStorageConfig(),
    message: "Upload endpoint - POST multipart/form-data with images field",
    limits: { maxSizeMB: 5, maxFiles: 5, allowedTypes: ["JPEG", "PNG", "WebP", "AVIF"] },
  });
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || "anon";
  const rl = rateLimit(`upload:${ip}`, 10, 60_000);
  if (!rl.ok) return NextResponse.json({ error: "Rate limited - too many uploads" }, { status: 429 });

  // Require merchant auth for upload
  const auth = verifyUserRequest(req, ["MERCHANT", "ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error || "Merchant authentication required for upload" }, { status: 401 });
  }

  // Check merchant status if merchant
  if (auth.user.role === "MERCHANT") {
    const { readDB } = await import("@/lib/db");
    const db = readDB();
    const merchant = db.merchants.find(m => m.id === auth.user.merchantId);
    if (!merchant) return NextResponse.json({ error: "Merchant profile not found" }, { status: 404 });
    if (merchant.status !== "approved") {
      return NextResponse.json({ error: `Merchant status ${merchant.status} - only APPROVED merchants can upload. Current: ${merchant.status}` }, { status: 403 });
    }
  }

  try {
    const formData = await req.formData();
    const files = formData.getAll("images") as File[];
    
    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No images provided - use 'images' field" }, { status: 400 });
    }

    if (files.length > 5) {
      return NextResponse.json({ error: "Too many files - max 5 images" }, { status: 400 });
    }

    const results = [];
    const errors = [];

    for (const file of files) {
      if (!(file instanceof File)) continue;
      
      const validation = validateImageFile(file);
      if (!validation.valid) {
        errors.push({ file: file.name, error: validation.error });
        continue;
      }

      try {
        const uploaded = await uploadImage(file);
        results.push({ originalName: file.name, ...uploaded });
      } catch (e: any) {
        errors.push({ file: file.name, error: e.message });
      }
    }

    if (results.length === 0 && errors.length > 0) {
      return NextResponse.json({ error: "All uploads failed", errors }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      uploaded: results,
      errors: errors.length > 0 ? errors : undefined,
      count: results.length,
      storage: getStorageConfig(),
    });
  } catch (e: any) {
    console.error("[upload] error", e);
    return NextResponse.json({ error: e.message || "Upload failed" }, { status: 500 });
  }
}

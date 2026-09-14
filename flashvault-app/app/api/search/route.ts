import { NextResponse } from "next/server";
import { readDB } from "@/lib/db";

export const dynamic = "force-dynamic";

// Server-side search: product name/brand/category + filters + sorting + pagination

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim().toLowerCase();
    const category = searchParams.get("category") || "";
    const brand = searchParams.get("brand") || "";
    const minPrice = searchParams.get("minPrice") ? Number(searchParams.get("minPrice")) : undefined;
    const maxPrice = searchParams.get("maxPrice") ? Number(searchParams.get("maxPrice")) : undefined;
    const minDiscount = searchParams.get("minDiscount") ? Number(searchParams.get("minDiscount")) : undefined;
    const inStock = searchParams.get("inStock") === "true";
    const sort = searchParams.get("sort") || "newest"; // newest, price_asc, price_desc, discount, availability
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 12));

    const db = readDB();
    let products = [...db.products];

    // Only show approved / active? For customer, show all non-rejected? Keep logic: show all except pending merchant? For now show all that are not explicitly rejected
    // But hide products from pending merchants? Already filtered in public pages. We'll keep same.

    // Search q in name/brand/category/description
    if (q) {
      products = products.filter((p: any) =>
        p.name.toLowerCase().includes(q) ||
        (p.brand && p.brand.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q)) ||
        (p.description && p.description.toLowerCase().includes(q))
      );
    }

    if (category) {
      products = products.filter((p: any) => p.category === category);
    }

    if (brand) {
      products = products.filter((p: any) => p.brand === brand);
    }

    if (minPrice !== undefined) {
      products = products.filter((p: any) => (p.vaultPrice || p.originalPrice) >= minPrice);
    }

    if (maxPrice !== undefined) {
      products = products.filter((p: any) => (p.vaultPrice || p.originalPrice) <= maxPrice);
    }

    if (minDiscount !== undefined) {
      products = products.filter((p: any) => (p.discountPercent || 0) >= minDiscount);
    }

    if (inStock) {
      products = products.filter((p: any) => (p.stock ?? 0) > 0);
    }

    // Sorting
    switch (sort) {
      case "price_asc":
        products.sort((a: any, b: any) => (a.vaultPrice || a.originalPrice) - (b.vaultPrice || b.originalPrice));
        break;
      case "price_desc":
        products.sort((a: any, b: any) => (b.vaultPrice || b.originalPrice) - (a.vaultPrice || a.originalPrice));
        break;
      case "discount":
        products.sort((a: any, b: any) => (b.discountPercent || 0) - (a.discountPercent || 0));
        break;
      case "availability":
        products.sort((a: any, b: any) => (b.stock || 0) - (a.stock || 0));
        break;
      case "newest":
      default:
        products.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
    }

    const total = products.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const paginated = products.slice(start, start + limit);

    // Facets for filters
    const allCategories = Array.from(new Set(db.products.map((p: any) => p.category).filter(Boolean))) as string[];
    const allBrands = Array.from(new Set(db.products.map((p: any) => p.brand).filter(Boolean))) as string[];

    return NextResponse.json({
      products: paginated,
      pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
      facets: { categories: allCategories, brands: allBrands },
      query: { q, category, brand, minPrice, maxPrice, minDiscount, inStock, sort },
    });
  } catch (e: any) {
    console.error("[search] error", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

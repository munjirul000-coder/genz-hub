import type { MetadataRoute } from "next";
import { readDB } from "@/lib/db";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://flashvault-bd.onrender.com";
  const now = new Date();

  let db: any;
  try {
    db = readDB();
  } catch {
    db = { products: [], drops: [] };
  }

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${baseUrl}/drop`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${baseUrl}/merchant`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${baseUrl}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  const productRoutes: MetadataRoute.Sitemap = (db.products || [])
    .filter((p: any) => p.status !== "pending" && p.approvalStatus !== "pending")
    .slice(0, 1000)
    .map((p: any) => ({
      url: `${baseUrl}/product/${p.id}`,
      lastModified: p.updatedAt ? new Date(p.updatedAt) : now,
      changeFrequency: "daily" as const,
      priority: 0.8,
    }));

  const dropRoutes: MetadataRoute.Sitemap = (db.drops || []).slice(0, 100).map((d: any) => ({
    url: `${baseUrl}/drop?dropId=${d.id}`,
    lastModified: d.startAt ? new Date(d.startAt) : now,
    changeFrequency: "hourly" as const,
    priority: 0.6,
  }));

  return [...staticRoutes, ...productRoutes, ...dropRoutes];
}

import type { Metadata } from "next";
import ProductDetailsClient from "@/components/product-details-client";
import { readDB } from "@/lib/db";

type Props = { params: { id: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://flashvault-bd.onrender.com";
  try {
    const db = readDB();
    const product = db.products.find((p: any) => p.id === params.id);
    if (!product) {
      return { title: "Product Not Found | FlashVault BD", robots: { index: false, follow: false } };
    }
    const title = `${product.title} — ${product.brand} | ${product.discountPercent}% OFF | FlashVault BD`;
    const description = `${product.title} by ${product.brand}. Original ${product.originalPrice} BDT, Vault ${product.vaultPrice} BDT. ${product.discountPercent}% OFF. ${product.availableQuantity} pcs left. Real inventory, server-enforced vault. Category: ${product.category}.`;
    const canonical = `${baseUrl}/product/${product.id}`;
    const image = product.image || `${baseUrl}/og-default.jpg`;
    return {
      title,
      description,
      alternates: { canonical },
      openGraph: {
        type: "website",
        url: canonical,
        title,
        description,
        siteName: "FlashVault BD",
        images: [{ url: image, width: 800, height: 1000, alt: product.title }],
      },
      twitter: { card: "summary_large_image", title, description, images: [image] },
      keywords: [product.brand, product.category, product.title, "FlashVault", "BD surplus", `${product.discountPercent}% off`],
    };
  } catch {
    return { title: "Product | FlashVault BD" };
  }
}

export default function ProductPage({ params }: Props) {
  return <ProductDetailsClient />;
}

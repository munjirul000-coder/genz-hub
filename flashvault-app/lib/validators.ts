import { z } from "zod";

export const productSubmitSchema = z.object({
  brand: z.string().min(2).max(100),
  title: z.string().min(4).max(200),
  description: z.string().min(10).max(2000).optional(),
  originalPrice: z.number().min(100).max(1000000),
  vaultPrice: z.number().min(50).max(1000000),
  stock: z.number().int().min(1).max(10000),
  category: z.enum(["Mens", "Womens", "Kids", "Footwear", "Accessories", "Unisex"]),
  merchantName: z.string().min(2).max(100),
  phone: z.string().min(11).max(15).regex(/^01[3-9]\d{8}$/, "Invalid BD phone"),
  size: z.string().optional(),
  condition: z.enum(["New", "Surplus", "Deadstock", "Sample"]).optional().default("Surplus"),
  location: z.string().optional(),
}).refine((data) => data.vaultPrice < data.originalPrice, {
  message: "Vault price must be less than original price",
  path: ["vaultPrice"],
}).refine((data) => {
  const discount = ((data.originalPrice - data.vaultPrice) / data.originalPrice) * 100;
  return discount <= 90 && discount >= 10;
}, {
  message: "Discount must be between 10% and 90%",
  path: ["vaultPrice"],
});

export const orderCreateSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(10).default(1),
  customerPhone: z.string().min(11).max(15),
  customerName: z.string().min(2).max(100).optional(),
  address: z.string().min(5).max(500),
  city: z.string().min(2).max(100),
  area: z.string().optional(),
  idempotencyKey: z.string().min(5).max(100),
});

export const dropCreateSchema = z.object({
  title: z.string().min(3).max(100),
  scheduledAt: z.number().min(Date.now() - 60000), // allow now
  durationMinutes: z.number().int().min(10).max(180),
  productIds: z.array(z.string()).min(1).max(50),
});

export const approveActionSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["approve", "reject", "live", "suspend", "remove"]),
  reason: z.string().max(500).optional(),
});

export function calculateDiscountPercent(original: number, vault: number): number {
  if (original <= 0) return 0;
  return Math.round(((original - vault) / original) * 100);
}

export function validatePricing(original: number, vault: number): { valid: boolean; discount: number; error?: string } {
  if (vault >= original) return { valid: false, discount: 0, error: "Vault price must be less than original" };
  const discount = calculateDiscountPercent(original, vault);
  if (discount < 10) return { valid: false, discount, error: "Discount too low (<10%)" };
  if (discount > 90) return { valid: false, discount, error: "Discount too high (>90%) - suspicious" };
  return { valid: true, discount };
}

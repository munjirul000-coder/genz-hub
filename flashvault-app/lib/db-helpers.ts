import { prisma, isPrismaEnabled } from "./prisma";
import { readDB as readJsonDB, writeDB as writeJsonDB, getRealStats as getJsonStats } from "./db";
import type { Product, Merchant, User, Order, DropSchedule, AuditLog } from "./types";

// Unified DB adapter - uses Prisma if DATABASE_URL set, else JSON fallback
// This ensures persistence across Render restarts when DATABASE_URL is set

export async function getProductsFromDB(): Promise<Product[]> {
  if (isPrismaEnabled() && prisma) {
    try {
      const products = await prisma.product.findMany({
        orderBy: { createdAt: "desc" },
      });
      // Convert Prisma Product to our Product type
      return products.map((p: any) => ({
        id: p.id,
        brand: p.brand,
        title: p.title,
        description: p.description || undefined,
        originalPrice: p.originalPrice,
        vaultPrice: p.vaultPrice,
        discountPercent: p.discountPercent,
        stock: p.stock,
        availableQuantity: p.availableQuantity,
        sold: p.sold,
        soldQuantity: p.soldQuantity,
        images: p.images,
        image: p.image,
        category: p.category,
        size: p.size || undefined,
        condition: p.condition as any,
        location: p.location || undefined,
        deliveryInfo: p.deliveryInfo || undefined,
        returnPolicy: p.returnPolicy || undefined,
        verificationStatus: p.verificationStatus.toLowerCase() as any,
        approvalStatus: p.approvalStatus.toLowerCase() as any,
        status: p.status.toLowerCase() as any,
        merchantId: p.merchantId,
        dropId: p.dropId || undefined,
        rejectionReason: p.rejectionReason || undefined,
        createdAt: new Date(p.createdAt).getTime(),
        updatedAt: new Date(p.updatedAt).getTime(),
        verifiedAt: p.verifiedAt ? new Date(p.verifiedAt).getTime() : undefined,
        verifiedBy: p.verifiedBy || undefined,
      }));
    } catch (e) {
      console.error("[prisma] getProducts failed, fallback to JSON", e);
      return readJsonDB().products;
    }
  }
  return readJsonDB().products;
}

export async function getProductByIdFromDB(id: string): Promise<{ product: Product | null; merchant: Merchant | null }> {
  if (isPrismaEnabled() && prisma) {
    try {
      const p = await prisma.product.findUnique({ where: { id } });
      if (!p) return { product: null, merchant: null };
      const merchant = await prisma.merchant.findUnique({ where: { id: p.merchantId } });
      const product: Product = {
        id: p.id,
        brand: p.brand,
        title: p.title,
        description: p.description || undefined,
        originalPrice: p.originalPrice,
        vaultPrice: p.vaultPrice,
        discountPercent: p.discountPercent,
        stock: p.stock,
        availableQuantity: p.availableQuantity,
        sold: p.sold,
        soldQuantity: p.soldQuantity,
        images: p.images,
        image: p.image,
        category: p.category,
        size: p.size || undefined,
        condition: p.condition as any,
        location: p.location || undefined,
        deliveryInfo: p.deliveryInfo || undefined,
        returnPolicy: p.returnPolicy || undefined,
        verificationStatus: p.verificationStatus.toLowerCase() as any,
        approvalStatus: p.approvalStatus.toLowerCase() as any,
        status: p.status.toLowerCase() as any,
        merchantId: p.merchantId,
        dropId: p.dropId || undefined,
        rejectionReason: p.rejectionReason || undefined,
        createdAt: new Date(p.createdAt).getTime(),
        updatedAt: new Date(p.updatedAt).getTime(),
        verifiedAt: p.verifiedAt ? new Date(p.verifiedAt).getTime() : undefined,
        verifiedBy: p.verifiedBy || undefined,
      };
      const m: Merchant | null = merchant ? {
        id: merchant.id,
        name: merchant.name,
        brand: merchant.brand,
        phone: merchant.phone,
        email: merchant.email || "",
        verified: merchant.verified,
        status: merchant.status.toLowerCase() as any,
        totalSales: merchant.totalSales,
        totalOrders: merchant.totalOrders,
        payoutBalance: merchant.payoutBalance,
        totalPayouts: merchant.totalPayouts,
        rating: merchant.rating || undefined,
        address: merchant.address || undefined,
        createdAt: new Date(merchant.createdAt).getTime(),
        updatedAt: new Date(merchant.updatedAt).getTime(),
        suspendedReason: merchant.suspendedReason || undefined,
      } : null;
      return { product, merchant: m };
    } catch (e) {
      console.error("[prisma] getProductById failed, fallback", e);
    }
  }
  const db = readJsonDB();
  const product = db.products.find(p => p.id === id) || null;
  const merchant = product ? db.merchants.find(m => m.id === product.merchantId) || null : null;
  return { product, merchant };
}

export async function getRealStatsFromDB() {
  if (isPrismaEnabled() && prisma) {
    try {
      const [totalProducts, liveProducts, pendingProducts, approvedProducts, rejectedProducts, totalOrders, completedOrders, cancelledOrders, totalMerchants, verifiedMerchants, products, orders] = await Promise.all([
        prisma.product.count(),
        prisma.product.count({ where: { status: { in: ["LIVE", "APPROVED"] } } }),
        prisma.product.count({ where: { status: "PENDING" } }),
        prisma.product.count({ where: { status: { in: ["APPROVED", "LIVE"] } } }),
        prisma.product.count({ where: { status: "REJECTED" } }),
        prisma.order.count(),
        prisma.order.count({ where: { status: { in: ["DELIVERED", "PAYOUT_RELEASED"] } } }),
        prisma.order.count({ where: { status: "CANCELLED" } }),
        prisma.merchant.count(),
        prisma.merchant.count({ where: { status: "APPROVED" } }),
        prisma.product.findMany({ where: { status: { in: ["LIVE", "APPROVED"] } } }),
        prisma.order.findMany(),
      ]);

      const totalSales = orders.reduce((s: number, o: any) => s + o.totalAmount, 0);
      const platformRevenue = orders.reduce((s: number, o: any) => s + o.commission, 0);
      const merchantEarnings = orders.reduce((s: number, o: any) => s + o.merchantEarning, 0);
      const avgDiscount = products.length > 0 ? Math.round(products.reduce((s: number, p: any) => s + p.discountPercent, 0) / products.length) : 0;
      const totalStock = (await prisma.product.aggregate({ _sum: { availableQuantity: true } }))._sum.availableQuantity || 0;
      const totalSold = (await prisma.product.aggregate({ _sum: { soldQuantity: true } }))._sum.soldQuantity || 0;

      return {
        totalProducts,
        liveProducts,
        pendingProducts,
        approvedProducts,
        rejectedProducts,
        totalOrders,
        completedOrders,
        cancelledOrders,
        totalSales,
        platformRevenue,
        merchantEarnings,
        totalMerchants,
        verifiedMerchants,
        totalUsers: await prisma.user.count(),
        avgDiscount,
        totalStock,
        totalSold,
      };
    } catch (e) {
      console.error("[prisma] stats failed, fallback", e);
      return getJsonStats();
    }
  }
  return getJsonStats();
}

export async function getUserByEmail(email: string): Promise<User | null> {
  if (isPrismaEnabled() && prisma) {
    try {
      const u = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
      if (!u) return null;
      return {
        id: u.id,
        role: u.role as any,
        name: u.name,
        phone: u.phone || "",
        email: u.email || undefined,
        passwordHash: u.passwordHash || undefined,
        merchantId: u.merchantId || undefined,
        createdAt: new Date(u.createdAt).getTime(),
        lastLogin: u.lastLogin ? new Date(u.lastLogin).getTime() : undefined,
        isSuspended: u.isSuspended,
        resetToken: u.resetToken || undefined,
        resetExpiry: u.resetExpiry ? new Date(u.resetExpiry).getTime() : undefined,
      };
    } catch {}
  }
  const db = readJsonDB();
  return db.users.find(u => u.email?.toLowerCase() === email.toLowerCase()) || null;
}

export async function getOrdersByCustomerId(customerId: string): Promise<Order[]> {
  if (isPrismaEnabled() && prisma) {
    try {
      const orders = await prisma.order.findMany({ where: { customerId }, orderBy: { createdAt: "desc" } });
      return orders.map((o: any) => ({
        id: o.id,
        productId: o.productId || "",
        productTitle: "", // will be fetched separately
        quantity: o.quantity,
        amount: o.amount,
        commission: o.commission,
        merchantEarning: o.merchantEarning,
        customerId: o.customerId || undefined,
        customerPhone: o.customerPhone,
        customerName: o.customerName || undefined,
        customerEmail: o.customerEmail || undefined,
        shippingAddress: o.shippingAddress,
        city: o.city,
        area: o.area || undefined,
        deliveryFee: o.deliveryFee,
        totalAmount: o.totalAmount,
        status: o.status.toLowerCase() as any,
        paymentStatus: o.paymentStatus.toLowerCase() as any,
        deliveryStatus: o.deliveryStatus.toLowerCase() as any,
        courierTracking: o.courierTracking || undefined,
        courierName: o.courierName || undefined,
        idempotencyKey: o.idempotencyKey,
        createdAt: new Date(o.createdAt).getTime(),
        updatedAt: new Date(o.updatedAt).getTime(),
        deliveredAt: o.deliveredAt ? new Date(o.deliveredAt).getTime() : undefined,
        payoutReleasedAt: o.payoutReleasedAt ? new Date(o.payoutReleasedAt).getTime() : undefined,
      }));
    } catch {}
  }
  const db = readJsonDB();
  return db.orders.filter(o => o.customerId === customerId);
}

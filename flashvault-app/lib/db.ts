import fs from "fs";
import { DB_PATH, ensureDataDir } from "./store";
import { defaultSettings } from "./settings";
import type { Product, Merchant, User, Order, DropConfig, PlatformSettings, AuditLog, DropSchedule } from "./types";

export type { Product, Merchant, User, Order, DropConfig, PlatformSettings, AuditLog, DropSchedule } from "./types";
export type ProductStatus = import("./types").ProductStatus;
export type ProductCondition = import("./types").ProductCondition;
export type MerchantStatus = import("./types").MerchantStatus;
export type UserRole = import("./types").UserRole;
export type OrderStatus = import("./types").OrderStatus;

export type DB = {
  products: Product[];
  merchants: Merchant[];
  users: User[];
  orders: Order[];
  drops: DropSchedule[];
  drop: DropConfig;
  settings: PlatformSettings;
  auditLogs: AuditLog[];
  idempotencyKeys: Record<string, { orderId: string; createdAt: number }>;
};

const defaultDB: DB = {
  products: [
    {
      id: "p1",
      brand: "Aarong",
      title: "Handloom Cotton Panjabi — Surplus Lot",
      description: "Authentic handloom cotton panjabi from Aarong surplus stock.",
      originalPrice: 4500,
      vaultPrice: 890,
      discountPercent: 80,
      stock: 42,
      availableQuantity: 42,
      sold: 18,
      soldQuantity: 18,
      images: ["https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&h=750&fit=crop"],
      image: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&h=750&fit=crop",
      category: "Mens",
      condition: "Surplus",
      location: "Dhaka, Bangladesh",
      deliveryInfo: "Pathao 24h inside Dhaka, 48h outside",
      returnPolicy: "No return - vault sale",
      verificationStatus: "verified",
      approvalStatus: "live",
      status: "live",
      merchantId: "m1",
      createdAt: Date.now() - 86400000 * 2,
      updatedAt: Date.now() - 86400000 * 2,
      verifiedAt: Date.now() - 86400000,
      verifiedBy: "admin",
    },
    {
      id: "p2",
      brand: "Yellow",
      title: "Oversized Linen Shirt — Export Leftover",
      description: "Oversized linen shirt, export quality.",
      originalPrice: 3200,
      vaultPrice: 650,
      discountPercent: 80,
      stock: 28,
      availableQuantity: 28,
      sold: 22,
      soldQuantity: 22,
      images: ["https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&h=750&fit=crop&crop=top"],
      image: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&h=750&fit=crop&crop=top",
      category: "Womens",
      condition: "Deadstock",
      location: "Dhaka, Bangladesh",
      deliveryInfo: "Pathao 24h",
      returnPolicy: "No return",
      verificationStatus: "verified",
      approvalStatus: "live",
      status: "live",
      merchantId: "m1",
      createdAt: Date.now() - 86400000,
      updatedAt: Date.now() - 86400000,
      verifiedAt: Date.now() - 86400000,
      verifiedBy: "admin",
    },
    {
      id: "p3",
      brand: "Sailor",
      title: "Raw Denim Jeans — Deadstock",
      description: "Raw denim jeans deadstock.",
      originalPrice: 3800,
      vaultPrice: 720,
      discountPercent: 81,
      stock: 15,
      availableQuantity: 15,
      sold: 9,
      soldQuantity: 9,
      images: ["https://images.unsplash.com/photo-1542272604-787c3835535d?w=600&h=800&fit=crop"],
      image: "https://images.unsplash.com/photo-1542272604-787c3835535d?w=600&h=800&fit=crop",
      category: "Mens",
      condition: "Deadstock",
      location: "Gazipur, Bangladesh",
      deliveryInfo: "Pathao",
      returnPolicy: "No return",
      verificationStatus: "unverified",
      approvalStatus: "pending",
      status: "pending",
      merchantId: "m2",
      createdAt: Date.now() - 3600000,
      updatedAt: Date.now() - 3600000,
    },
  ],
  merchants: [
    {
      id: "m1",
      name: "Rafsan J.",
      brand: "Dhaka Surplus Co.",
      phone: "01712345678",
      email: "rafsan@surplus.bd",
      verified: true,
      status: "approved",
      totalSales: 124500,
      totalOrders: 40,
      payoutBalance: 12000,
      totalPayouts: 112500,
      createdAt: Date.now() - 86400000 * 10,
      updatedAt: Date.now() - 86400000 * 2,
    },
    {
      id: "m2",
      name: "Nusrat A.",
      brand: "Nusrat Fabrics",
      phone: "01887654321",
      email: "nusrat@fab.bd",
      verified: false,
      status: "pending",
      totalSales: 0,
      totalOrders: 0,
      payoutBalance: 0,
      totalPayouts: 0,
      createdAt: Date.now() - 3600000,
      updatedAt: Date.now() - 3600000,
    },
  ],
  users: [
    {
      id: "u_admin",
      role: "SUPER_ADMIN",
      name: "Super Admin",
      phone: "01700000000",
      email: "admin@flashvault.bd",
      createdAt: Date.now() - 86400000 * 30,
    },
  ],
  orders: [
    {
      id: "o1",
      productId: "p1",
      productTitle: "Handloom Cotton Panjabi — Surplus Lot",
      quantity: 1,
      amount: 890,
      commission: 89,
      merchantEarning: 801,
      customerPhone: "017xx-xxx123",
      shippingAddress: "Dhanmondi, Dhaka",
      city: "Dhaka",
      deliveryFee: 80,
      totalAmount: 970,
      status: "delivered",
      paymentStatus: "paid",
      deliveryStatus: "delivered",
      courierTracking: "PATHAO-89231",
      courierName: "Pathao",
      idempotencyKey: "idem_o1",
      createdAt: Date.now() - 86400000,
      updatedAt: Date.now() - 86400000,
      deliveredAt: Date.now() - 86400000 + 3600000 * 20,
    },
    {
      id: "o2",
      productId: "p2",
      productTitle: "Oversized Linen Shirt",
      quantity: 1,
      amount: 650,
      commission: 65,
      merchantEarning: 585,
      customerPhone: "018xx-xxx456",
      shippingAddress: "Gulshan, Dhaka",
      city: "Dhaka",
      deliveryFee: 80,
      totalAmount: 730,
      status: "shipped",
      paymentStatus: "paid",
      deliveryStatus: "shipped",
      courierTracking: "REDX-44123",
      courierName: "RedX",
      idempotencyKey: "idem_o2",
      createdAt: Date.now() - 3600000 * 5,
      updatedAt: Date.now() - 3600000 * 5,
    },
  ],
  drops: [
    {
      id: "drop_next",
      title: "Friday Night Vault — Oct 18",
      scheduledAt: Date.now() + 86400000 * 2 + 3600000 * 3,
      durationMinutes: 60,
      status: "UPCOMING",
      productIds: ["p1", "p2"],
      createdAt: Date.now() - 86400000,
      createdBy: "system",
    },
  ],
  drop: {
    isLocked: true,
    nextDropAt: Date.now() + 86400000 * 2 + 3600000 * 3,
    liveTraffic: 14230,
    totalGross: 847230,
  },
  settings: defaultSettings,
  auditLogs: [],
  idempotencyKeys: {},
};

function migrateDB(raw: any): DB {
  const db = { ...defaultDB, ...raw } as DB;
  db.products = (raw.products || defaultDB.products).map((p: any) => {
    const base = {
      discountPercent: p.discountPercent ?? Math.round(((p.originalPrice - p.vaultPrice) / p.originalPrice) * 100),
      availableQuantity: p.availableQuantity ?? p.stock ?? 0,
      soldQuantity: p.soldQuantity ?? p.sold ?? 0,
      images: p.images ?? [p.image],
      condition: p.condition ?? "Surplus",
      verificationStatus: p.verificationStatus ?? "unverified",
      approvalStatus: p.approvalStatus ?? p.status ?? "pending",
      createdAt: p.createdAt ?? Date.now(),
      updatedAt: p.updatedAt ?? p.createdAt ?? Date.now(),
      description: p.description ?? p.title,
      deliveryInfo: p.deliveryInfo ?? "Pathao 24h",
      returnPolicy: p.returnPolicy ?? "No return",
      location: p.location ?? "Dhaka",
    };
    return { ...base, ...p, discountPercent: base.discountPercent, availableQuantity: base.availableQuantity, soldQuantity: base.soldQuantity, images: base.images };
  });
  db.merchants = (raw.merchants || []).map((m: any) => ({
    status: m.status ?? (m.verified ? "approved" : "pending"),
    totalOrders: m.totalOrders ?? 0,
    payoutBalance: m.payoutBalance ?? 0,
    totalPayouts: m.totalPayouts ?? 0,
    updatedAt: m.updatedAt ?? m.createdAt ?? Date.now(),
    ...m,
  }));
  db.users = raw.users || defaultDB.users;
  db.orders = (raw.orders || []).map((o: any) => ({
    quantity: o.quantity ?? 1,
    merchantEarning: o.merchantEarning ?? o.amount - o.commission,
    shippingAddress: o.shippingAddress ?? "Dhaka, Bangladesh",
    city: o.city ?? "Dhaka",
    deliveryFee: o.deliveryFee ?? 80,
    totalAmount: o.totalAmount ?? o.amount + 80,
    paymentStatus: o.paymentStatus ?? (o.status === "paid" || o.status === "delivered" ? "paid" : "pending"),
    deliveryStatus: o.deliveryStatus ?? o.status ?? "pending",
    idempotencyKey: o.idempotencyKey ?? "idem_" + o.id,
    updatedAt: o.updatedAt ?? o.createdAt ?? Date.now(),
    ...o,
  }));
  db.drops = raw.drops || defaultDB.drops;
  db.settings = { ...defaultSettings, ...(raw.settings || {}) };
  db.auditLogs = raw.auditLogs || [];
  db.idempotencyKeys = raw.idempotencyKeys || {};
  db.drop = { ...defaultDB.drop, ...(raw.drop || {}) };
  return db;
}

export function readDB(): DB {
  try {
    ensureDataDir();
    if (!fs.existsSync(DB_PATH)) {
      fs.writeFileSync(DB_PATH, JSON.stringify(defaultDB, null, 2));
      return defaultDB;
    }
    const raw = fs.readFileSync(DB_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return migrateDB(parsed);
  } catch (e) {
    console.error("[db] read failed, using default", e);
    return defaultDB;
  }
}

export function writeDB(db: DB) {
  try {
    ensureDataDir();
    const tmpPath = DB_PATH + ".tmp";
    fs.writeFileSync(tmpPath, JSON.stringify(db, null, 2));
    fs.renameSync(tmpPath, DB_PATH);
  } catch (e) {
    console.error("[db] write failed", e);
    throw e;
  }
}

export function getRealStats() {
  const db = readDB();
  const liveProducts = db.products.filter(p => p.status === "live" || p.status === "approved");
  const totalProducts = db.products.length;
  const pendingProducts = db.products.filter(p => p.status === "pending").length;
  const approvedProducts = db.products.filter(p => p.status === "approved" || p.status === "live").length;
  const rejectedProducts = db.products.filter(p => p.status === "rejected").length;
  const totalOrders = db.orders.length;
  const completedOrders = db.orders.filter(o => o.status === "delivered" || o.status === "payout_released").length;
  const cancelledOrders = db.orders.filter(o => o.status === "cancelled").length;
  const totalSales = db.orders.reduce((s, o) => s + o.totalAmount, 0);
  const platformRevenue = db.orders.reduce((s, o) => s + o.commission, 0);
  const merchantEarnings = db.orders.reduce((s, o) => s + o.merchantEarning, 0);
  const totalMerchants = db.merchants.length;
  const verifiedMerchants = db.merchants.filter(m => m.verified || m.status === "approved").length;
  const totalUsers = db.users.length + db.merchants.length;
  const avgDiscount = liveProducts.length > 0 ? Math.round(liveProducts.reduce((s, p) => s + p.discountPercent, 0) / liveProducts.length) : 0;
  const totalStock = db.products.reduce((s, p) => s + p.availableQuantity, 0);
  const totalSold = db.products.reduce((s, p) => s + p.soldQuantity, 0);
  return {
    totalProducts,
    liveProducts: liveProducts.length,
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
    totalUsers,
    avgDiscount,
    totalStock,
    totalSold,
    realLiveTraffic: db.drop.liveTraffic,
  };
}

export function listLiveProducts(): Product[] {
  const db = readDB();
  return db.products.filter((p) => p.status === "live" || p.status === "approved");
}

export function listPendingProducts(): Product[] {
  return readDB().products.filter((p) => p.status === "pending");
}

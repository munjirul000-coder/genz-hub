import fs from "fs";
import path from "path";

export type ProductStatus = "pending" | "approved" | "rejected" | "live" | "soldout";
export type Product = {
  id: string;
  brand: string;
  title: string;
  originalPrice: number;
  vaultPrice: number;
  stock: number;
  sold: number;
  image: string;
  category: string;
  status: ProductStatus;
  merchantId: string;
  createdAt: number;
};
export type Merchant = {
  id: string;
  name: string;
  brand: string;
  phone: string;
  email: string;
  verified: boolean;
  totalSales: number;
  createdAt: number;
};
export type Order = {
  id: string;
  productId: string;
  productTitle: string;
  amount: number;
  commission: number;
  customerPhone: string;
  status: "paid" | "shipped" | "delivered" | "payout_released";
  courierTracking?: string;
  createdAt: number;
};
export type DropConfig = {
  isLocked: boolean;
  nextDropAt: number;
  liveTraffic: number;
  totalGross: number;
};

const DB_PATH = path.join(process.cwd(), "data", "db.json");

type DB = {
  products: Product[];
  merchants: Merchant[];
  orders: Order[];
  drop: DropConfig;
};

const defaultDB: DB = {
  products: [
    {
      id: "p1",
      brand: "Aarong",
      title: "Handloom Cotton Panjabi — Surplus Lot",
      originalPrice: 4500,
      vaultPrice: 890,
      stock: 42,
      sold: 18,
      image: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&h=750&fit=crop",
      category: "Mens",
      status: "live",
      merchantId: "m1",
      createdAt: Date.now() - 86400000 * 2,
    },
    {
      id: "p2",
      brand: "Yellow",
      title: "Oversized Linen Shirt — Export Leftover",
      originalPrice: 3200,
      vaultPrice: 650,
      stock: 28,
      sold: 22,
      image: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&h=750&fit=crop&crop=top",
      category: "Womens",
      status: "live",
      merchantId: "m1",
      createdAt: Date.now() - 86400000,
    },
    {
      id: "p3",
      brand: "Sailor",
      title: "Raw Denim Jeans — Deadstock",
      originalPrice: 3800,
      vaultPrice: 720,
      stock: 15,
      sold: 9,
      image: "https://images.unsplash.com/photo-1542272604-787c3835535d?w=600&h=800&fit=crop",
      category: "Mens",
      status: "pending",
      merchantId: "m2",
      createdAt: Date.now() - 3600000,
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
      totalSales: 124500,
      createdAt: Date.now() - 86400000 * 10,
    },
    {
      id: "m2",
      name: "Nusrat A.",
      brand: "Nusrat Fabrics",
      phone: "01887654321",
      email: "nusrat@fab.bd",
      verified: false,
      totalSales: 0,
      createdAt: Date.now() - 3600000,
    },
  ],
  orders: [
    {
      id: "o1",
      productId: "p1",
      productTitle: "Handloom Cotton Panjabi — Surplus Lot",
      amount: 890,
      commission: 89,
      customerPhone: "017xx-xxx123",
      status: "delivered",
      courierTracking: "PATHAO-89231",
      createdAt: Date.now() - 86400000,
    },
    {
      id: "o2",
      productId: "p2",
      productTitle: "Oversized Linen Shirt",
      amount: 650,
      commission: 65,
      customerPhone: "018xx-xxx456",
      status: "shipped",
      courierTracking: "REDX-44123",
      createdAt: Date.now() - 3600000 * 5,
    },
  ],
  drop: {
    isLocked: true,
    nextDropAt: Date.now() + 86400000 * 2 + 3600000 * 3,
    liveTraffic: 14230,
    totalGross: 847230,
  },
};

function ensureDB(): DB {
  try {
    if (!fs.existsSync(DB_PATH)) {
      fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
      fs.writeFileSync(DB_PATH, JSON.stringify(defaultDB, null, 2));
      return defaultDB;
    }
    const raw = fs.readFileSync(DB_PATH, "utf8");
    return JSON.parse(raw) as DB;
  } catch {
    return defaultDB;
  }
}

export function readDB(): DB {
  return ensureDB();
}
export function writeDB(db: DB) {
  try {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
  } catch (e) {
    console.error("[db] write failed", e);
  }
}

// Helpers
export function listLiveProducts(): Product[] {
  const db = readDB();
  return db.products.filter((p) => p.status === "live" || p.status === "approved");
}
export function listPendingProducts(): Product[] {
  return readDB().products.filter((p) => p.status === "pending");
}

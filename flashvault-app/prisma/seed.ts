import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding from data/db.json if exists...");

  const dbPath = path.join(__dirname, "../data/db.json");
  if (!fs.existsSync(dbPath)) {
    console.log("No db.json found, creating default settings and super admin");
    // Create default settings
    await prisma.setting.upsert({
      where: { key: "platform" },
      update: {},
      create: {
        key: "platform",
        value: {
          commissionPercent: 10,
          shippingFeeInsideDhaka: 80,
          shippingFeeOutside: 120,
          dropDay: 5,
          dropStartHour: 21,
          dropStartMinute: 0,
          dropDurationMinutes: 60,
          timezone: "Asia/Dhaka",
        },
      },
    });
    console.log("Default settings created");
    return;
  }

  const raw = fs.readFileSync(dbPath, "utf-8");
  const db = JSON.parse(raw);

  // Seed users
  for (const u of db.users || []) {
    await prisma.user.upsert({
      where: { id: u.id },
      update: {},
      create: {
        id: u.id,
        email: u.email,
        name: u.name,
        phone: u.phone || null,
        passwordHash: u.passwordHash || u.password || "hashed",
        role: u.role || "CUSTOMER",
        merchantId: u.merchantId || null,
        isSuspended: u.isSuspended || false,
        createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
        updatedAt: u.updatedAt ? new Date(u.updatedAt) : new Date(),
      },
    });
  }
  console.log(`Seeded ${db.users?.length || 0} users`);

  // Seed merchants
  for (const m of db.merchants || []) {
    await prisma.merchant.upsert({
      where: { id: m.id },
      update: {},
      create: {
        id: m.id,
        name: m.name,
        brand: m.brand,
        phone: m.phone,
        email: m.email || null,
        status: (m.status?.toUpperCase() || "PENDING") as any,
        verified: m.verified || false,
        totalSales: m.totalSales || 0,
        totalOrders: m.totalOrders || 0,
        payoutBalance: m.payoutBalance || 0,
        totalPayouts: m.totalPayouts || 0,
        createdAt: m.createdAt ? new Date(m.createdAt) : new Date(),
        updatedAt: m.updatedAt ? new Date(m.updatedAt) : new Date(),
      },
    });
  }
  console.log(`Seeded ${db.merchants?.length || 0} merchants`);

  // Seed products
  for (const p of db.products || []) {
    await prisma.product.upsert({
      where: { id: p.id },
      update: {},
      create: {
        id: p.id,
        title: p.title,
        description: p.description || "",
        brand: p.brand,
        category: p.category,
        size: p.size || null,
        condition: p.condition || "Surplus",
        location: p.location || "Dhaka, Bangladesh",
        originalPrice: p.originalPrice,
        vaultPrice: p.vaultPrice,
        discountPercent: p.discountPercent || Math.round(((p.originalPrice - p.vaultPrice) / p.originalPrice) * 100),
        stock: p.stock,
        availableQuantity: p.availableQuantity ?? p.stock,
        soldQuantity: p.soldQuantity || 0,
        image: p.image,
        images: p.images || [p.image],
        status: (p.status?.toUpperCase() || "PENDING") as any,
        approvalStatus: (p.approvalStatus?.toUpperCase() || "PENDING") as any,
        verificationStatus: (p.verificationStatus?.toUpperCase() || "UNVERIFIED") as any,
        merchantId: p.merchantId,
        createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
        updatedAt: p.updatedAt ? new Date(p.updatedAt) : new Date(),
      },
    });
  }
  console.log(`Seeded ${db.products?.length || 0} products`);

  // Seed settings
  if (db.settings) {
    await prisma.setting.upsert({
      where: { key: "platform" },
      update: { value: db.settings },
      create: { key: "platform", value: db.settings },
    });
  }

  console.log("Seed completed");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

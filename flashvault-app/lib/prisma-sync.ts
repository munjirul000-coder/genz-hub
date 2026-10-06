// Two-way persistence bridge: JSON-shaped DB <-> Postgres (Supabase) via Prisma
// WHY: Render's filesystem is ephemeral — data/db.json is wiped on every restart/redeploy.
// This module makes every writeDB() mirror to Postgres, and every server boot
// hydrates the DB from Postgres. Result: orders/users/products survive restarts
// and appear in admin instantly (no more "order confirmed but admin shows nothing").

import { prisma, isPrismaEnabled } from "./prisma";
import type { DB } from "./db";
import type { Product, Merchant, User, Order, DropSchedule, AuditLog } from "./types";

export function isPersistent(): boolean {
  return isPrismaEnabled() && !!prisma;
}

const num = (n: any): number => (typeof n === "number" && isFinite(n) ? n : 0);
const dateOrNull = (n?: number): Date | null => (typeof n === "number" && n > 0 ? new Date(n) : null);
const upper = (s: string): string => (s ? s.toUpperCase() : s);

// ---------------------------------------------------------------- hydrate (boot)
export async function hydrateFromPrisma(): Promise<Partial<DB> | null> {
  if (!isPersistent()) return null;
  const p = prisma!;
  try {
    const [merchants, users, products, orders, drops, dropConfig, settings, auditLogs, notifications] = await Promise.all([
      p.merchant.findMany(),
      p.user.findMany(),
      p.product.findMany(),
      p.order.findMany({ include: { items: true } }),
      p.drop.findMany(),
      p.dropConfig.findFirst(),
      p.setting.findFirst(),
      p.auditLog.findMany(),
      p.notification.findMany(),
    ]);

    // First boot (empty DB) -> keep JSON seed, it will be pushed up on first write
    if (merchants.length === 0 && users.length === 0 && products.length === 0 && orders.length === 0) {
      return null;
    }

    const db: Partial<DB> & { notifications?: any[] } = {};

    db.merchants = merchants.map((m: any): Merchant => ({
      id: m.id,
      name: m.name,
      brand: m.brand,
      phone: m.phone || "",
      email: m.email || "",
      verified: !!m.verified,
      status: (m.status || "pending").toLowerCase() as any,
      totalSales: num(m.totalSales),
      totalOrders: num(m.totalOrders),
      rating: m.rating ?? undefined,
      address: m.address ?? undefined,
      payoutBalance: num(m.payoutBalance),
      totalPayouts: num(m.totalPayouts),
      createdAt: new Date(m.createdAt).getTime(),
      updatedAt: new Date(m.updatedAt).getTime(),
      suspendedReason: m.suspendedReason ?? undefined,
    }));

    db.users = users.map((u: any): User => ({
      id: u.id,
      role: (u.role || "CUSTOMER").toUpperCase() as any,
      name: u.name,
      phone: u.phone || "",
      email: u.email ?? undefined,
      passwordHash: u.passwordHash ?? undefined,
      merchantId: u.merchantId ?? undefined,
      createdAt: new Date(u.createdAt).getTime(),
      lastLogin: u.lastLogin ? new Date(u.lastLogin).getTime() : undefined,
      isSuspended: !!u.isSuspended,
      resetToken: u.resetToken ?? undefined,
      resetExpiry: u.resetExpiry ? new Date(u.resetExpiry).getTime() : undefined,
    }));

    db.products = products.map((p2: any): Product => ({
      id: p2.id,
      brand: p2.brand,
      title: p2.title,
      description: p2.description ?? undefined,
      originalPrice: num(p2.originalPrice),
      vaultPrice: num(p2.vaultPrice),
      discountPercent: num(p2.discountPercent),
      stock: num(p2.stock),
      availableQuantity: num(p2.availableQuantity),
      sold: num(p2.sold),
      soldQuantity: num(p2.soldQuantity),
      images: p2.images || [],
      image: p2.image || (p2.images || [])[0] || "",
      category: p2.category,
      size: p2.size ?? undefined,
      condition: (p2.condition || "Surplus") as any,
      location: p2.location ?? undefined,
      deliveryInfo: p2.deliveryInfo ?? undefined,
      returnPolicy: p2.returnPolicy ?? undefined,
      verificationStatus: (p2.verificationStatus || "unverified").toLowerCase() as any,
      approvalStatus: (p2.approvalStatus || "pending").toLowerCase() as any,
      status: (p2.status || "pending").toLowerCase() as any,
      merchantId: p2.merchantId,
      dropId: p2.dropId ?? undefined,
      rejectionReason: p2.rejectionReason ?? undefined,
      createdAt: new Date(p2.createdAt).getTime(),
      updatedAt: new Date(p2.updatedAt).getTime(),
      verifiedAt: p2.verifiedAt ? new Date(p2.verifiedAt).getTime() : undefined,
      verifiedBy: p2.verifiedBy ?? undefined,
    }));

    db.orders = orders.map((o: any): Order => ({
      id: o.id,
      productId: o.productId || (o.items?.[0]?.productId ?? ""),
      productTitle: o.items?.[0]?.title ?? "",
      quantity: num(o.quantity),
      amount: num(o.amount),
      commission: num(o.commission),
      merchantEarning: num(o.merchantEarning),
      customerId: o.customerId ?? undefined,
      customerPhone: o.customerPhone || "",
      customerName: o.customerName ?? undefined,
      customerEmail: o.customerEmail ?? undefined,
      shippingAddress: o.shippingAddress || "",
      city: o.city || "",
      area: o.area ?? undefined,
      deliveryFee: num(o.deliveryFee),
      totalAmount: num(o.totalAmount),
      status: (o.status || "confirmed").toLowerCase() as any,
      paymentStatus: (o.paymentStatus || "pending").toLowerCase() as any,
      deliveryStatus: (o.deliveryStatus || "processing").toLowerCase() as any,
      courierTracking: o.courierTracking ?? undefined,
      courierName: o.courierName ?? undefined,
      idempotencyKey: o.idempotencyKey || o.id,
      createdAt: new Date(o.createdAt).getTime(),
      updatedAt: new Date(o.updatedAt).getTime(),
      deliveredAt: o.deliveredAt ? new Date(o.deliveredAt).getTime() : undefined,
      payoutReleasedAt: o.payoutReleasedAt ? new Date(o.payoutReleasedAt).getTime() : undefined,
    }));

    db.drops = drops.map((d: any): DropSchedule => ({
      id: d.id,
      title: d.title,
      scheduledAt: new Date(d.scheduledAt).getTime(),
      durationMinutes: num(d.durationMinutes),
      status: (d.status || "UPCOMING") as any,
      productIds: d.productIds || [],
      createdAt: new Date(d.createdAt).getTime(),
      createdBy: d.createdBy ?? undefined,
    }));

    db.drop = {
      isLocked: dropConfig ? !!dropConfig.isLocked : true,
      nextDropAt: dropConfig?.nextDropAt ? new Date(dropConfig.nextDropAt).getTime() : Date.now() + 86400000,
      liveTraffic: num(dropConfig?.liveTraffic) || 14230,
      totalGross: num(dropConfig?.totalGross),
      currentDropId: dropConfig?.currentDropId ?? undefined,
    };

    if (settings) {
      db.settings = {
        platformName: settings.platformName,
        currency: settings.currency,
        timezone: settings.timezone,
        dropDay: num(settings.dropDay),
        dropStartHour: num(settings.dropStartHour),
        dropStartMinute: num(settings.dropStartMinute),
        dropDurationMinutes: num(settings.dropDurationMinutes),
        commissionPercent: num(settings.commissionPercent),
        minOrderAmount: num(settings.minOrderAmount),
        shippingFeeInsideDhaka: num(settings.shippingFeeInsideDhaka),
        shippingFeeOutside: num(settings.shippingFeeOutside),
        maintenanceMode: !!settings.maintenanceMode,
        logoUrl: settings.logoUrl ?? undefined,
      } as any;
    }

    db.auditLogs = auditLogs.map((a: any): AuditLog => ({
      id: a.id,
      timestamp: new Date(a.timestamp).getTime(),
      actorId: a.actorId,
      actorRole: a.actorRole,
      action: a.action,
      targetType: a.targetType,
      targetId: a.targetId,
      metadata: a.metadata ?? undefined,
      ip: a.ip ?? undefined,
    }));

    (db as any).notifications = notifications.map((n: any) => ({
      id: n.id,
      userId: n.userId ?? undefined,
      orderId: n.orderId ?? undefined,
      title: n.title,
      message: n.message,
      type: n.type,
      read: !!n.isRead,
      createdAt: new Date(n.createdAt).getTime(),
    }));

    return db;
  } catch (e) {
    console.error("[prisma-sync] hydrate failed", e);
    return null;
  }
}

// ---------------------------------------------------------------- sync (after every write)
let syncChain: Promise<void> = Promise.resolve();

export function syncToPrisma(db: DB): Promise<void> {
  // serialize syncs so concurrent writes can't interleave
  syncChain = syncChain.then(() => doSync(db)).catch((e) => console.error("[prisma-sync] sync failed", e));
  return syncChain;
}

async function doSync(db: DB): Promise<void> {
  if (!isPersistent()) return;
  const p = prisma!;
  const merchantIds = new Set(db.merchants.map((m) => m.id));
  const userIds = new Set(db.users.map((u) => u.id));
  const productIds = new Set(db.products.map((x) => x.id));
  const orderIds = new Set(db.orders.map((o) => o.id));
  const dropIds = new Set(db.drops.map((d) => d.id));

  // ---- merchants (no FK)
  for (const m of db.merchants) {
    await p.merchant.upsert({
      where: { id: m.id },
      create: {
        id: m.id, name: m.name, brand: m.brand, phone: m.phone || "", email: m.email || "",
        verified: !!m.verified, status: upper(m.status || "PENDING") as any,
        totalSales: num(m.totalSales), totalOrders: num(m.totalOrders), rating: m.rating ?? null,
        address: m.address ?? null, payoutBalance: num(m.payoutBalance), totalPayouts: num(m.totalPayouts),
        createdAt: new Date(m.createdAt), updatedAt: new Date(m.updatedAt),
        suspendedReason: m.suspendedReason ?? null,
      },
      update: {
        name: m.name, brand: m.brand, phone: m.phone || "", email: m.email || "",
        verified: !!m.verified, status: upper(m.status || "PENDING") as any,
        totalSales: num(m.totalSales), totalOrders: num(m.totalOrders),
        payoutBalance: num(m.payoutBalance), totalPayouts: num(m.totalPayouts),
        updatedAt: new Date(m.updatedAt), suspendedReason: m.suspendedReason ?? null,
      },
    });
  }

  // ---- users (FK: merchant)
  for (const u of db.users) {
    const data = {
      role: upper(u.role || "CUSTOMER") as any,
      name: u.name,
      phone: u.phone || "",
      email: u.email ?? null,
      passwordHash: u.passwordHash ?? null,
      merchantId: u.merchantId && merchantIds.has(u.merchantId) ? u.merchantId : null,
      isSuspended: !!u.isSuspended,
      resetToken: u.resetToken ?? null,
      resetExpiry: dateOrNull(u.resetExpiry),
    };
    await p.user.upsert({
      where: { id: u.id },
      create: { id: u.id, createdAt: new Date(u.createdAt), lastLogin: dateOrNull(u.lastLogin), ...data },
      update: { ...data, lastLogin: dateOrNull(u.lastLogin) ?? undefined },
    });
  }

  // ---- products (FK: merchant, drop)
  for (const x of db.products) {
    const data = {
      brand: x.brand, title: x.title, description: x.description ?? null,
      originalPrice: num(x.originalPrice), vaultPrice: num(x.vaultPrice), discountPercent: num(x.discountPercent),
      stock: num(x.stock), availableQuantity: num(x.availableQuantity), sold: num(x.sold), soldQuantity: num(x.soldQuantity),
      images: x.images || [], image: x.image || "", category: x.category, size: x.size ?? null,
      condition: upper(x.condition || "SURPLUS") as any,
      location: x.location ?? null, deliveryInfo: x.deliveryInfo ?? null, returnPolicy: x.returnPolicy ?? null,
      verificationStatus: upper(x.verificationStatus || "UNVERIFIED") as any,
      approvalStatus: upper(x.approvalStatus || "PENDING") as any,
      status: upper(x.status || "PENDING") as any,
      merchantId: x.merchantId,
      dropId: x.dropId && dropIds.has(x.dropId) ? x.dropId : null,
      rejectionReason: x.rejectionReason ?? null,
      verifiedAt: dateOrNull(x.verifiedAt), verifiedBy: x.verifiedBy ?? null,
    };
    await p.product.upsert({
      where: { id: x.id },
      create: { id: x.id, createdAt: new Date(x.createdAt), updatedAt: new Date(x.updatedAt), ...data },
      update: { ...data, updatedAt: new Date(x.updatedAt) },
    });
  }

  // ---- drops
  for (const d of db.drops) {
    const data = {
      title: d.title, scheduledAt: new Date(d.scheduledAt), durationMinutes: num(d.durationMinutes),
      status: upper(d.status || "UPCOMING") as any, productIds: d.productIds || [],
      createdBy: d.createdBy ?? null,
    };
    await p.drop.upsert({
      where: { id: d.id },
      create: { id: d.id, createdAt: new Date(d.createdAt), ...data },
      update: data,
    });
  }

  // ---- orders (+ item + payment) — FK: user, product
  for (const o of db.orders) {
    const oData = {
      productId: o.productId && productIds.has(o.productId) ? o.productId : null,
      quantity: num(o.quantity), amount: num(o.amount), commission: num(o.commission), merchantEarning: num(o.merchantEarning),
      customerId: o.customerId && userIds.has(o.customerId) ? o.customerId : null,
      customerPhone: o.customerPhone || "", customerName: o.customerName ?? null, customerEmail: o.customerEmail ?? null,
      shippingAddress: o.shippingAddress || "", city: o.city || "", area: o.area ?? null,
      deliveryFee: num(o.deliveryFee), totalAmount: num(o.totalAmount),
      status: upper(o.status || "CONFIRMED") as any,
      paymentStatus: upper(o.paymentStatus || "PENDING") as any,
      deliveryStatus: upper(o.deliveryStatus || "PROCESSING") as any,
      courierTracking: o.courierTracking ?? null, courierName: o.courierName ?? null,
      idempotencyKey: o.idempotencyKey || o.id,
      deliveredAt: dateOrNull(o.deliveredAt), payoutReleasedAt: dateOrNull(o.payoutReleasedAt),
    };
    await p.order.upsert({
      where: { id: o.id },
      create: { id: o.id, createdAt: new Date(o.createdAt), updatedAt: new Date(o.updatedAt), ...oData },
      update: { ...oData, updatedAt: new Date(o.updatedAt) },
    });

    // product title lives in OrderItem (flat JSON order -> one item row)
    if (o.productId && productIds.has(o.productId) && o.productTitle) {
      const existingItem = await p.orderItem.findFirst({ where: { orderId: o.id } });
      const itemData = {
        productId: o.productId, quantity: num(o.quantity),
        price: num(o.quantity) > 0 ? Math.round(num(o.amount) / num(o.quantity)) : num(o.amount),
        title: o.productTitle,
      };
      if (existingItem) {
        await p.orderItem.update({ where: { id: existingItem.id }, data: itemData });
      } else {
        await p.orderItem.create({ data: { orderId: o.id, ...itemData } });
      }
    }

    // payment row (COD status mirror)
    await p.payment.upsert({
      where: { orderId: o.id },
      create: { orderId: o.id, amount: num(o.totalAmount), method: "cod", status: upper(o.paymentStatus || "PENDING") as any, verified: o.paymentStatus === "paid" },
      update: { amount: num(o.totalAmount), status: upper(o.paymentStatus || "PENDING") as any, verified: o.paymentStatus === "paid" },
    }).catch(() => {}); // payment table optional
  }

  // ---- drop config (single row)
  if (db.drop) {
    const dcData = {
      isLocked: !!db.drop.isLocked,
      nextDropAt: dateOrNull(db.drop.nextDropAt),
      liveTraffic: num(db.drop.liveTraffic), totalGross: num(db.drop.totalGross),
      currentDropId: db.drop.currentDropId ?? null,
    };
    const existing = await p.dropConfig.findFirst();
    if (existing) await p.dropConfig.update({ where: { id: existing.id }, data: dcData });
    else await p.dropConfig.create({ data: dcData });
  }

  // ---- settings (single row)
  if (db.settings) {
    const sData = {
      platformName: db.settings.platformName, currency: db.settings.currency, timezone: db.settings.timezone,
      dropDay: num(db.settings.dropDay), dropStartHour: num(db.settings.dropStartHour), dropStartMinute: num(db.settings.dropStartMinute),
      dropDurationMinutes: num(db.settings.dropDurationMinutes), commissionPercent: num(db.settings.commissionPercent),
      minOrderAmount: num(db.settings.minOrderAmount), shippingFeeInsideDhaka: num(db.settings.shippingFeeInsideDhaka),
      shippingFeeOutside: num(db.settings.shippingFeeOutside), maintenanceMode: !!db.settings.maintenanceMode,
      logoUrl: (db.settings as any).logoUrl ?? null,
    };
    const existing = await p.setting.findFirst();
    if (existing) await p.setting.update({ where: { id: existing.id }, data: sData });
    else await p.setting.create({ data: sData });
  }

  // ---- audit logs
  for (const a of (db.auditLogs || []).slice(-200)) {
    await p.auditLog.upsert({
      where: { id: a.id },
      create: {
        id: a.id, timestamp: new Date(a.timestamp),
        actorId: userIds.has(a.actorId) ? a.actorId : "u_admin",
        actorRole: a.actorRole, action: upper(a.action) as any, targetType: a.targetType, targetId: a.targetId,
        metadata: (a.metadata ?? undefined) as any, ip: a.ip ?? null,
      },
      update: { actorRole: a.actorRole, action: upper(a.action) as any, metadata: (a.metadata ?? undefined) as any },
    }).catch(() => {});
  }

  // ---- notifications (stored on db via routes)
  const notifs: any[] = (db as any).notifications || [];
  for (const n of notifs.slice(-200)) {
    await p.notification.upsert({
      where: { id: n.id },
      create: {
        id: n.id,
        userId: n.userId && userIds.has(n.userId) ? n.userId : null,
        orderId: n.orderId && orderIds.has(n.orderId) ? n.orderId : null,
        title: n.title || "", message: n.message || "", type: n.type || "INFO",
        isRead: !!n.read, createdAt: new Date(n.createdAt || Date.now()),
      },
      update: { isRead: !!n.read, title: n.title || "", message: n.message || "" },
    }).catch(() => {});
  }

  // ---- prune rows deleted from JSON (mirror = source of truth)
  // guard: only prune when the JSON collection is non-empty (never wipe on edge cases)
  if (merchantIds.size > 0) await p.merchant.deleteMany({ where: { id: { notIn: Array.from(merchantIds) } } }).catch(() => {});
  if (productIds.size > 0) await p.product.deleteMany({ where: { id: { notIn: Array.from(productIds) } } }).catch(() => {});
  if (orderIds.size > 0) await p.order.deleteMany({ where: { id: { notIn: Array.from(orderIds) } } }).catch(() => {});
  if (dropIds.size > 0) await p.drop.deleteMany({ where: { id: { notIn: Array.from(dropIds) } } }).catch(() => {});
  if (userIds.size > 0) await p.user.deleteMany({ where: { id: { notIn: Array.from(userIds) } } }).catch(() => {});
}

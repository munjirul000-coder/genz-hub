import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient | null {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn("[prisma] DATABASE_URL not set - using JSON fallback. Set DATABASE_URL for persistent Postgres.");
    return null;
  }
  try {
    if (global.prisma) return global.prisma;
    const client = new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    });
    if (process.env.NODE_ENV !== "production") global.prisma = client;
    return client;
  } catch (e) {
    console.error("[prisma] Failed to create client", e);
    return null;
  }
}

export const prisma: PrismaClient | null = createPrismaClient();

export function isPrismaEnabled(): boolean {
  return !!process.env.DATABASE_URL && !!prisma;
}

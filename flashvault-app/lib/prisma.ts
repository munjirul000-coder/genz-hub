// Lazy Prisma client with resilient fallback - never breaks build if @prisma/client not generated
// If DATABASE_URL missing or client not generated, returns null and uses JSON fallback

declare global {
  var prisma: any | undefined;
}

function createPrismaClient(): any | null {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn("[prisma] DATABASE_URL not set - using JSON fallback. Set DATABASE_URL for persistent Postgres.");
    return null;
  }

  try {
    // Dynamic require to avoid build-time failure if client not generated
    let PrismaClient: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      PrismaClient = require("@prisma/client").PrismaClient;
    } catch (e) {
      console.warn("[prisma] @prisma/client not generated yet - using JSON fallback. Run prisma generate with DATABASE_URL set.");
      return null;
    }

    if (!PrismaClient) return null;

    if (global.prisma) return global.prisma;

    const client = new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    });

    if (process.env.NODE_ENV !== "production") global.prisma = client;

    return client;
  } catch (e) {
    console.error("[prisma] Failed to create client, fallback to JSON", e);
    return null;
  }
}

export const prisma: any | null = createPrismaClient();

export function isPrismaEnabled(): boolean {
  return !!process.env.DATABASE_URL && !!prisma;
}

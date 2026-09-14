import { NextRequest } from "next/server";

export type UserRole = "CUSTOMER" | "MERCHANT" | "ADMIN" | "SUPER_ADMIN";

export type AuthUser = {
  id: string;
  role: UserRole;
  email?: string;
  name?: string;
};

// Env-based secrets - never expose to client
function getAdminKeys(): { adminKey: string; superAdminKey: string } {
  return {
    adminKey: process.env.ADMIN_KEY || process.env.NEXT_PUBLIC_ADMIN_KEY || "FLASHVAULT2026",
    superAdminKey: process.env.SUPER_ADMIN_KEY || process.env.ADMIN_KEY || "FLASHVAULT_SUPER_2026",
  };
}

export function verifyAdminRequest(req: Request | NextRequest): { ok: boolean; role: UserRole | null; error?: string } {
  const { adminKey, superAdminKey } = getAdminKeys();
  const headers = req.headers;
  const authHeader = headers.get("authorization") || headers.get("x-admin-key") || "";
  const key = authHeader.replace("Bearer ", "").trim();

  // Also check cookie for server-side
  const cookieKey = (req as any).cookies?.get?.("fv_admin_key")?.value;

  const provided = key || cookieKey || "";

  if (!provided) return { ok: false, role: null, error: "Missing admin key" };

  if (provided === superAdminKey) return { ok: true, role: "SUPER_ADMIN" };
  if (provided === adminKey) return { ok: true, role: "ADMIN" };

  return { ok: false, role: null, error: "Invalid admin key" };
}

export function requireRole(allowed: UserRole[], userRole: UserRole | null): boolean {
  if (!userRole) return false;
  // SUPER_ADMIN can do everything
  if (userRole === "SUPER_ADMIN") return true;
  return allowed.includes(userRole);
}

// Client-side helper to get key from localStorage (only for admin UI, not security boundary)
export const ADMIN_KEY_STORAGE = "fv-admin-key";

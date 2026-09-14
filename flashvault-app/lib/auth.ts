import { NextRequest } from "next/server";
import { verifyJWT, getTokenFromRequest } from "./jwt";
import { readDB } from "./db";

export type UserRole = "CUSTOMER" | "MERCHANT" | "ADMIN" | "SUPER_ADMIN";

export type AuthUser = {
  id: string;
  role: UserRole;
  email?: string;
  name?: string;
};

function getAdminKeys(): { adminKey: string; superAdminKey: string } | null {
  const adminKey = process.env.ADMIN_KEY || process.env.NEXT_PUBLIC_ADMIN_KEY;
  const superAdminKey = process.env.SUPER_ADMIN_KEY || process.env.ADMIN_KEY;

  // In production, require env vars - fail safe, no default fallback
  if (process.env.NODE_ENV === "production") {
    if (!adminKey || !superAdminKey) {
      console.error("[CRITICAL] ADMIN_KEY/SUPER_ADMIN_KEY missing in production - denying legacy key auth");
      return null;
    }
  }

  // Dev fallback with warning
  if (!adminKey) {
    console.warn("[auth] ADMIN_KEY not set, using fallback FLASHVAULT2026 - set ADMIN_KEY env for production");
    return {
      adminKey: "FLASHVAULT2026",
      superAdminKey: process.env.SUPER_ADMIN_KEY || "FLASHVAULT_SUPER_2026",
    };
  }

  return {
    adminKey,
    superAdminKey: superAdminKey || adminKey,
  };
}

export function verifyAdminRequest(req: Request | NextRequest): { ok: boolean; role: UserRole | null; user?: any; error?: string } {
  // First try JWT auth (secure, primary)
  const token = getTokenFromRequest(req);
  if (token) {
    const verified = verifyJWT(token);
    if (verified.valid && verified.payload) {
      const db = readDB();
      const user = db.users.find(u => u.id === verified.payload!.id);
      if (user && !user.isSuspended) {
        if (user.role === "SUPER_ADMIN" || user.role === "ADMIN") {
          return { ok: true, role: user.role as UserRole, user };
        }
      }
    }
  }

  // Fallback to legacy admin key - but require env in prod, fail safe
  const keys = getAdminKeys();
  if (!keys) {
    return { ok: false, role: null, error: "Admin key auth disabled in production - use JWT login. Set ADMIN_KEY/SUPER_ADMIN_KEY env." };
  }

  const { adminKey, superAdminKey } = keys;
  const headers = req.headers;
  const authHeader = headers.get("authorization") || headers.get("x-admin-key") || "";
  const key = authHeader.replace("Bearer ", "").trim();
  const cookieKey = (req as any).cookies?.get?.("fv_admin_key")?.value;
  const provided = key || cookieKey || "";

  if (!provided) return { ok: false, role: null, error: "Missing admin key or session" };

  if (provided === superAdminKey) return { ok: true, role: "SUPER_ADMIN" };
  if (provided === adminKey) return { ok: true, role: "ADMIN" };

  // In prod, if keys are set but provided is legacy default, deny
  if (process.env.NODE_ENV === "production" && (provided === "FLASHVAULT2026" || provided === "FLASHVAULT_SUPER_2026")) {
    console.error("[CRITICAL] Attempt to use default admin key in production denied");
    return { ok: false, role: null, error: "Default admin key not allowed in production" };
  }

  return { ok: false, role: null, error: "Invalid admin key" };
}

export function verifyUserRequest(req: Request, allowedRoles?: UserRole[]): { ok: boolean; user?: any; role?: UserRole; error?: string } {
  const token = getTokenFromRequest(req);
  if (!token) return { ok: false, error: "Not authenticated" };
  const verified = verifyJWT(token);
  if (!verified.valid || !verified.payload) return { ok: false, error: verified.error || "Invalid session" };

  const db = readDB();
  const user = db.users.find(u => u.id === verified.payload!.id);
  if (!user) return { ok: false, error: "User not found" };
  if (user.isSuspended) return { ok: false, error: "Account suspended" };

  if (allowedRoles && !allowedRoles.includes(user.role as UserRole)) {
    // SUPER_ADMIN can access all
    if (user.role !== "SUPER_ADMIN") {
      return { ok: false, error: "Forbidden - insufficient role" };
    }
  }

  return { ok: true, user, role: user.role as UserRole };
}

export function requireRole(allowed: UserRole[], userRole: UserRole | null): boolean {
  if (!userRole) return false;
  if (userRole === "SUPER_ADMIN") return true;
  return allowed.includes(userRole);
}

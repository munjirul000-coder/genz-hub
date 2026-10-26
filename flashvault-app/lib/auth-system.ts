import { readDB, writeDB, ensureHydrated, DB } from "./db";
import { hashPassword, verifyPassword, isStrongPassword } from "./password";
import { signJWT, verifyJWT, getTokenFromRequest } from "./jwt";
import { dbMutex } from "./store";
import { sendEmail, verificationEmailHtml, loginAlertEmailHtml, isEmailConfigured } from "./mailer";
import crypto from "crypto";

export type AuthResult = {
  ok: boolean;
  user?: any;
  token?: string;
  error?: string;
  status?: number;
};

export function getCurrentUserFromRequest(req: Request): { user: any | null; error?: string } {
  const token = getTokenFromRequest(req);
  if (!token) return { user: null };
  const verified = verifyJWT(token);
  if (!verified.valid || !verified.payload) return { user: null, error: verified.error };
  const db = readDB();
  const user = db.users.find(u => u.id === verified.payload!.id);
  if (!user) return { user: null, error: "User not found" };
  if (user.isSuspended) return { user: null, error: "Account suspended" };
  return { user };
}

export async function signupCustomer(data: { name: string; email: string; password: string }): Promise<AuthResult> {
  const { name, email, password } = data;
  if (!name || name.trim().length < 2) return { ok: false, error: "Name must be at least 2 characters", status: 400 };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Invalid email", status: 400 };
  const pwCheck = isStrongPassword(password);
  if (!pwCheck.ok) return { ok: false, error: pwCheck.reason, status: 400 };

  const release = await dbMutex.acquire();
  try {
    const db = readDB();
    const exists = db.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (exists) return { ok: false, error: "Email already registered", status: 409 };

    const newUser = {
      id: "u_" + Date.now() + "_" + crypto.randomBytes(3).toString("hex"),
      role: "CUSTOMER" as const,
      name: name.trim(),
      phone: "",
      email: email.toLowerCase().trim(),
      passwordHash: hashPassword(password),
      createdAt: Date.now(),
      lastLogin: Date.now(),
      isSuspended: false,
      emailVerified: false,
      emailVerifyToken: crypto.randomBytes(24).toString("hex"),
      emailVerifyExpires: Date.now() + 24 * 60 * 60 * 1000,
    };

    db.users.push(newUser);
    writeDB(db);

    // Send verification email (skips silently if SMTP not configured)
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://flashvault-bd.onrender.com";
    const verifyLink = `${siteUrl}/api/auth/verify-email?token=${newUser.emailVerifyToken}`;
    sendEmail(newUser.email!, "Verify your FlashVault account", verificationEmailHtml(newUser.name, verifyLink)).catch(() => {});

    const token = signJWT({ id: newUser.id, role: newUser.role, email: newUser.email });
    const { passwordHash, resetToken, resetExpiry, emailVerifyToken, emailVerifyExpires, ...safeUser } = newUser as any;
    return { ok: true, user: safeUser, token };
  } finally {
    release();
  }
}

// ---------------------------------------------------------------
// Account lockout — brute-force protection (5 wrong passwords = 15 min lock)
// Stored in module memory: survives within a server instance. An attacker
// losing progress on restart is acceptable; DB columns not needed.
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const failedLogins = new Map<string, { count: number; lockedUntil?: number }>();

function lockoutKey(email: string) {
  return email.toLowerCase().trim();
}

function getLockState(email: string) {
  const s = failedLogins.get(lockoutKey(email));
  if (!s) return null;
  if (s.lockedUntil && Date.now() > s.lockedUntil) {
    failedLogins.delete(lockoutKey(email)); // lock expired
    return null;
  }
  return s;
}

function recordFailedLogin(email: string) {
  const key = lockoutKey(email);
  const s = failedLogins.get(key) || { count: 0 };
  s.count += 1;
  if (s.count >= MAX_FAILED_ATTEMPTS) {
    s.lockedUntil = Date.now() + LOCKOUT_MS;
    s.count = 0;
  }
  failedLogins.set(key, s);
}

function clearFailedLogins(email: string) {
  failedLogins.delete(lockoutKey(email));
}

export async function loginCustomer(email: string, password: string): Promise<AuthResult> {
  if (!email || !password) return { ok: false, error: "Email and password required", status: 400 };

  // Account lockout check — before even touching the DB (also hides account existence while locked)
  const lock = getLockState(email);
  if (lock?.lockedUntil) {
    const mins = Math.ceil((lock.lockedUntil - Date.now()) / 60000);
    return { ok: false, error: `Too many failed attempts. Account locked for ${mins} more minute(s).`, status: 423 };
  }

  const db = readDB();
  const user = db.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) return { ok: false, error: "Account not found", status: 404 };
  if (user.isSuspended) return { ok: false, error: "Account suspended. Contact support.", status: 403 };
  if (!user.passwordHash) return { ok: false, error: "Invalid account. Reset password.", status: 400 };
  if (!verifyPassword(password, user.passwordHash)) {
    recordFailedLogin(email);
    const s = getLockState(email);
    const left = s ? MAX_FAILED_ATTEMPTS - s.count : MAX_FAILED_ATTEMPTS;
    return { ok: false, error: left > 0 && left <= 2 ? `Incorrect password. ${left} attempt(s) left before 15-min lock.` : "Incorrect password", status: 401 };
  }

  clearFailedLogins(email);
  user.lastLogin = Date.now();
  writeDB(db);

  // Security alert email on every login (if SMTP configured)
  if (user.email && isEmailConfigured()) {
    const when = new Date().toLocaleString("en-GB", { timeZone: "Asia/Dhaka" });
    sendEmail(user.email, "New login to your FlashVault account", loginAlertEmailHtml(user.name, when)).catch(() => {});
  }

  const token = signJWT({ id: user.id, role: user.role, email: user.email });
  const { passwordHash, resetToken, resetExpiry, emailVerifyToken, emailVerifyExpires, ...safeUser } = user as any;
  return { ok: true, user: safeUser, token };
}

export async function signupMerchant(data: { name: string; brand: string; email: string; phone: string; password: string; businessInfo?: string }): Promise<AuthResult> {
  const { name, brand, email, phone, password } = data;
  if (!name || name.length < 2) return { ok: false, error: "Name required", status: 400 };
  if (!brand || brand.length < 2) return { ok: false, error: "Brand required", status: 400 };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Invalid email", status: 400 };
  if (!phone || !/^01[3-9]\d{8}$/.test(phone)) return { ok: false, error: "Invalid BD phone 01XXXXXXXXX", status: 400 };
  const pwCheck = isStrongPassword(password);
  if (!pwCheck.ok) return { ok: false, error: pwCheck.reason, status: 400 };

  const release = await dbMutex.acquire();
  try {
    const db = readDB();
    if (db.users.find(u => u.email?.toLowerCase() === email.toLowerCase())) {
      return { ok: false, error: "Email already registered", status: 409 };
    }
    if (db.merchants.find(m => m.phone === phone)) {
      // allow but check
    }

    const userId = "u_" + Date.now() + "_" + crypto.randomBytes(3).toString("hex");
    const merchantId = "m_" + Date.now() + "_" + crypto.randomBytes(3).toString("hex");

    const newUser = {
      id: userId,
      role: "MERCHANT" as const,
      name: name.trim(),
      phone,
      email: email.toLowerCase().trim(),
      passwordHash: hashPassword(password),
      merchantId,
      createdAt: Date.now(),
      lastLogin: Date.now(),
      isSuspended: false,
    };

    const newMerchant = {
      id: merchantId,
      name: name.trim(),
      brand: brand.trim(),
      phone,
      email: email.toLowerCase().trim(),
      verified: false,
      status: "pending" as const,
      totalSales: 0,
      totalOrders: 0,
      payoutBalance: 0,
      totalPayouts: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    db.users.push(newUser);
    db.merchants.push(newMerchant);
    writeDB(db);

    const token = signJWT({ id: newUser.id, role: newUser.role, email: newUser.email });
    const { passwordHash, resetToken, resetExpiry, emailVerifyToken, emailVerifyExpires, ...safeUser } = newUser as any;
    return { ok: true, user: { ...safeUser, merchant: newMerchant }, token };
  } finally {
    release();
  }
}

export async function loginMerchant(email: string, password: string): Promise<AuthResult> {
  const db = readDB();
  const user = db.users.find(u => u.email?.toLowerCase() === email.toLowerCase() && u.role === "MERCHANT");
  if (!user) return { ok: false, error: "Merchant account not found", status: 404 };
  if (user.isSuspended) return { ok: false, error: "Account suspended", status: 403 };
  if (!user.passwordHash || !verifyPassword(password, user.passwordHash)) return { ok: false, error: "Incorrect password", status: 401 };

  const merchant = db.merchants.find(m => m.id === user.merchantId);
  if (!merchant) return { ok: false, error: "Merchant profile not found", status: 404 };
  if (merchant.status === "suspended") return { ok: false, error: "Merchant suspended. Contact admin.", status: 403 };

  user.lastLogin = Date.now();
  writeDB(db);

  const token = signJWT({ id: user.id, role: user.role, email: user.email });
  const { passwordHash, resetToken, resetExpiry, emailVerifyToken, emailVerifyExpires, ...safeUser } = user as any;
  return { ok: true, user: { ...safeUser, merchant }, token };
}

// Keeps the super admin's password in sync with the SUPER_ADMIN_PASSWORD env var.
// Why: the original password was leaked in public docs — setting this env var
// immediately locks the old password out on the next boot, without any email flow.
let superAdminPwSynced = false;
export async function syncSuperAdminPasswordFromEnv(): Promise<void> {
  if (superAdminPwSynced) return;
  superAdminPwSynced = true;
  const password = process.env.SUPER_ADMIN_PASSWORD;
  if (!password) return;
  try {
    await ensureHydrated(); // never write before Postgres hydration completes
    const release = await dbMutex.acquire();
    try {
      const db = readDB();
      const email = (process.env.SUPER_ADMIN_EMAIL || "admin@flashvault.bd").toLowerCase();
      const su = db.users.find(u => u.role === "SUPER_ADMIN" && (u.email || "").toLowerCase() === email)
        || db.users.find(u => u.role === "SUPER_ADMIN");
      if (!su) return;
      if (su.passwordHash && verifyPassword(password, su.passwordHash)) return; // already in sync
      const pwCheck = isStrongPassword(password);
      if (!pwCheck.ok) {
        console.warn("[auth] SUPER_ADMIN_PASSWORD not strong enough, not applying:", pwCheck.reason);
        return;
      }
      su.passwordHash = hashPassword(password);
      writeDB(db);
      console.log("[auth] Super admin password updated from SUPER_ADMIN_PASSWORD env (old/leaked password no longer works)");
    } finally {
      release();
    }
  } catch (e) {
    console.error("[auth] super admin env password sync failed", e);
  }
}

export async function createSuperAdminIfNotExists(): Promise<void> {
  // Safe creation: only if no SUPER_ADMIN exists, create from env vars
  await ensureHydrated(); // never write before Postgres hydration completes
  const release = await dbMutex.acquire();
  try {
    const db = readDB();
    const hasSuper = db.users.some(u => u.role === "SUPER_ADMIN");
    if (hasSuper) {
      release();
      await syncSuperAdminPasswordFromEnv();
      return;
    }

    const email = process.env.SUPER_ADMIN_EMAIL || "admin@flashvault.bd";
    const password = process.env.SUPER_ADMIN_PASSWORD;
    const name = process.env.SUPER_ADMIN_NAME || "Super Admin";

    if (!password) {
      // Do not create hardcoded password - log warning
      console.warn("[auth] No SUPER_ADMIN_PASSWORD in env, skipping auto-create. Set env to create first super admin.");
      return;
    }

    const pwCheck = isStrongPassword(password);
    if (!pwCheck.ok) {
      console.warn("[auth] SUPER_ADMIN_PASSWORD not strong enough:", pwCheck.reason);
      return;
    }

    const newUser = {
      id: "u_super_" + Date.now(),
      role: "SUPER_ADMIN" as const,
      name,
      phone: process.env.SUPER_ADMIN_PHONE || "01700000000",
      email: email.toLowerCase(),
      passwordHash: hashPassword(password),
      createdAt: Date.now(),
      lastLogin: Date.now(),
      isSuspended: false,
    };

    db.users.push(newUser);
    writeDB(db);
    console.log(`[auth] Super admin created: ${email}`);
  } finally {
    release();
  }
}

// Forgot / Reset
export async function generateResetToken(email: string): Promise<AuthResult> {
  const db = readDB();
  const user = db.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) return { ok: false, error: "Account not found", status: 404 };

  const token = crypto.randomBytes(32).toString("hex");
  const expiry = Date.now() + 60 * 60 * 1000; // 1h

  // Store in user as resetToken (extend type via any)
  (user as any).resetToken = token;
  (user as any).resetExpiry = expiry;
  writeDB(db);

  // In production, send email. For now return token (dev mode)
  return { ok: true, user: { resetToken: token, email: user.email }, token };
}

export async function resetPassword(token: string, newPassword: string): Promise<AuthResult> {
  const pwCheck = isStrongPassword(newPassword);
  if (!pwCheck.ok) return { ok: false, error: pwCheck.reason, status: 400 };

  const release = await dbMutex.acquire();
  try {
    const db = readDB();
    const user = db.users.find(u => (u as any).resetToken === token);
    if (!user) return { ok: false, error: "Invalid reset token", status: 400 };
    const expiry = (user as any).resetExpiry;
    if (!expiry || Date.now() > expiry) return { ok: false, error: "Reset token expired", status: 400 };

    user.passwordHash = hashPassword(newPassword);
    (user as any).resetToken = undefined;
    (user as any).resetExpiry = undefined;
    writeDB(db);
    return { ok: true };
  } finally {
    release();
  }
}

// At server boot: apply the SUPER_ADMIN_PASSWORD env override (if set) right
// after Postgres hydration finishes, so a leaked old password can't be used
// even once before the owner logs in.
if (typeof window === "undefined" && process.env.NEXT_RUNTIME !== "edge") {
  syncSuperAdminPasswordFromEnv().catch(() => {});
}

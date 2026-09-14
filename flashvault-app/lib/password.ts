import crypto from "crypto";

// Secure password hashing using PBKDF2 (Node built-in, no external deps)
// Format: salt:hash:iterations
const ITERATIONS = 120000;
const KEYLEN = 64;
const DIGEST = "sha512";

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEYLEN, DIGEST).toString("hex");
  return `${salt}:${hash}:${ITERATIONS}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, hash, iterStr] = stored.split(":");
    const iterations = parseInt(iterStr, 10) || ITERATIONS;
    const hashVerify = crypto.pbkdf2Sync(password, salt, iterations, KEYLEN, DIGEST).toString("hex");
    // timingSafeEqual
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(hashVerify, "hex"));
  } catch {
    return false;
  }
}

export function isStrongPassword(pw: string): { ok: boolean; reason?: string } {
  if (pw.length < 8) return { ok: false, reason: "Password must be at least 8 characters" };
  if (!/[A-Z]/.test(pw)) return { ok: false, reason: "Password must contain uppercase letter" };
  if (!/[a-z]/.test(pw)) return { ok: false, reason: "Password must contain lowercase letter" };
  if (!/[0-9]/.test(pw)) return { ok: false, reason: "Password must contain a number" };
  return { ok: true };
}

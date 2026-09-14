import crypto from "crypto";

type JWTPayload = {
  id: string;
  role: string;
  email?: string;
  iat: number;
  exp: number;
};

function getSecret(): string {
  return process.env.JWT_SECRET || process.env.AUTH_SECRET || "flashvault_jwt_secret_change_in_prod_2026_secure";
}

function base64urlEncode(str: string | Buffer): string {
  const buf = typeof str === "string" ? Buffer.from(str) : str;
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64urlDecode(str: string): string {
  let s = str.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Buffer.from(s, "base64").toString();
}

export function signJWT(payload: Omit<JWTPayload, "iat" | "exp">, expiresInSec = 7 * 24 * 60 * 60): string {
  const secret = getSecret();
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JWTPayload = { ...payload, iat: now, exp: now + expiresInSec };

  const headerB64 = base64urlEncode(JSON.stringify(header));
  const payloadB64 = base64urlEncode(JSON.stringify(fullPayload));
  const data = `${headerB64}.${payloadB64}`;
  const sig = crypto.createHmac("sha256", secret).update(data).digest();
  const sigB64 = base64urlEncode(sig);
  return `${data}.${sigB64}`;
}

export function verifyJWT(token: string): { valid: boolean; payload?: JWTPayload; error?: string } {
  try {
    const secret = getSecret();
    const parts = token.split(".");
    if (parts.length !== 3) return { valid: false, error: "Invalid token format" };
    const [headerB64, payloadB64, sigB64] = parts;
    const data = `${headerB64}.${payloadB64}`;
    const expectedSig = crypto.createHmac("sha256", secret).update(data).digest();
    const expectedB64 = base64urlEncode(expectedSig);

    // timing safe compare
    if (!crypto.timingSafeEqual(Buffer.from(sigB64), Buffer.from(expectedB64))) {
      return { valid: false, error: "Invalid signature" };
    }

    const payloadJson = base64urlDecode(payloadB64);
    const payload = JSON.parse(payloadJson) as JWTPayload;
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) return { valid: false, error: "Token expired" };
    return { valid: true, payload };
  } catch (e: any) {
    return { valid: false, error: e.message || "Invalid token" };
  }
}

export function getTokenFromRequest(req: Request): string | null {
  // Check Authorization header
  const auth = req.headers.get("authorization");
  if (auth && auth.startsWith("Bearer ")) return auth.slice(7);
  // Check cookie header manually
  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader.match(/fv_token=([^;]+)/);
  if (match) return decodeURIComponent(match[1]);
  return null;
}

export function getTokenFromCookies(cookieString: string): string | null {
  const match = cookieString.match(/fv_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

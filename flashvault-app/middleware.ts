import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Edge-compatible JWT verification using Web Crypto
async function verifyJWTEdge(token: string, secret: string): Promise<{ valid: boolean; payload?: any; error?: string }> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return { valid: false, error: "Invalid format" };
    const [headerB64, payloadB64, sigB64] = parts;
    const data = `${headerB64}.${payloadB64}`;

    // Decode signature
    const sig = base64urlDecodeToBytes(sigB64);
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"]
    );
    const dataBytes = encoder.encode(data);
    const validSig = await crypto.subtle.verify("HMAC", key, sig as any, dataBytes as any);
    if (!validSig) return { valid: false, error: "Invalid signature" };

    // Decode payload
    const payloadJson = base64urlDecode(payloadB64);
    const payload = JSON.parse(payloadJson);
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return { valid: false, error: "Token expired" };
    return { valid: true, payload };
  } catch (e: any) {
    return { valid: false, error: e.message || "Invalid token" };
  }
}

function base64urlDecode(str: string): string {
  let s = str.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  try {
    return atob(s);
  } catch {
    return Buffer.from(s, "base64").toString();
  }
}

function base64urlDecodeToBytes(str: string): Uint8Array {
  let s = str.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const binary = atob(s);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function middleware(req: NextRequest) {
  const token = req.cookies.get("fv_token")?.value;
  const path = req.nextUrl.pathname;
  const method = req.method;
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://flashvault-bd.onrender.com";

  // CSRF Protection for state-changing API requests with cookie auth
  if (method !== "GET" && method !== "HEAD" && path.startsWith("/api/")) {
    // Allow auth endpoints without CSRF (login/signup have rate limiting)
    const csrfExempt = ["/api/auth/login", "/api/auth/signup", "/api/auth/merchant/login", "/api/auth/merchant/signup", "/api/auth/logout"];
    const isExempt = csrfExempt.some(p => path === p || path.startsWith(p));

    if (!isExempt && token) {
      // For cookie-authenticated requests, verify Origin/Referer
      const allowedOrigins = [siteUrl, "http://localhost:3001", "http://localhost:3000", "https://flashvault-bd.onrender.com"];
      const originValid = origin ? allowedOrigins.some(o => origin.startsWith(o)) : false;
      const refererValid = referer ? allowedOrigins.some(o => referer.startsWith(o)) : false;
      const hasCustomHeader = req.headers.get("x-requested-with") || req.headers.get("x-csrf-token");

      // If no Origin/Referer and no custom header, require it (CSRF protection)
      if (!originValid && !refererValid && !hasCustomHeader) {
        const secFetchSite = req.headers.get("sec-fetch-site");
        if (secFetchSite && secFetchSite !== "same-origin" && secFetchSite !== "same-site") {
          console.warn(`[csrf] Blocked ${method} ${path} - Origin: ${origin}, Referer: ${referer}, Sec-Fetch-Site: ${secFetchSite}`);
          return NextResponse.json({ error: "CSRF protection - invalid origin" }, { status: 403 });
        }
      }
    }
  }

  // Public routes - always allow
  const publicPaths = ["/", "/drop", "/product", "/login", "/signup", "/forgot-password", "/reset-password", "/api/auth", "/api/products", "/api/drop"];
  const isPublicApi = path.startsWith("/api/products") || path.startsWith("/api/drop/status") || path.startsWith("/api/auth");
  if (isPublicApi) {
    return NextResponse.next();
  }

  // Protected: /account requires valid JWT
  if (path.startsWith("/account")) {
    if (!token) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", path);
      return NextResponse.redirect(url);
    }
    // Proper JWT validation in middleware (not just existence)
    const secret = process.env.JWT_SECRET || process.env.AUTH_SECRET || "flashvault_jwt_secret_change_in_prod_2026_secure";
    const verified = await verifyJWTEdge(token, secret);
    if (!verified.valid) {
      console.warn(`[middleware] Invalid token for ${path}: ${verified.error}`);
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", path);
      url.searchParams.set("error", verified.error || "session_expired");
      // Clear invalid cookie
      const res = NextResponse.redirect(url);
      res.cookies.set("fv_token", "", { maxAge: 0, path: "/" });
      return res;
    }
    const res = NextResponse.next();
    res.headers.set("x-user-id", verified.payload?.id || "");
    res.headers.set("x-user-role", verified.payload?.role || "");
    return res;
  }

  // Protected: /merchant subpaths
  if (path.startsWith("/merchant/dashboard") || path.startsWith("/merchant/orders")) {
    if (!token) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", path);
      url.searchParams.set("role", "merchant");
      return NextResponse.redirect(url);
    }
    const secret = process.env.JWT_SECRET || process.env.AUTH_SECRET || "flashvault_jwt_secret_change_in_prod_2026_secure";
    const verified = await verifyJWTEdge(token, secret);
    if (!verified.valid) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", path);
      const res = NextResponse.redirect(url);
      res.cookies.set("fv_token", "", { maxAge: 0, path: "/" });
      return res;
    }
  }

  // Protected: /admin - allow page to handle auth but add security headers
  if (path.startsWith("/admin") || path.startsWith("/super-admin")) {
    const res = NextResponse.next();
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    return res;
  }

  const response = NextResponse.next();
  
  // Security headers for all responses
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  return response;
}

export const config = {
  matcher: ["/account/:path*", "/merchant/:path*", "/admin/:path*", "/super-admin/:path*", "/api/orders/:path*", "/api/admin/:path*", "/api/addresses/:path*", "/api/wishlist/:path*"],
};

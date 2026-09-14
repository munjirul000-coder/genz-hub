import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Simple JWT verify in middleware (edge-compatible using Web Crypto would be better, but we use simple check)
// For now, we check if token exists, detailed verification done in API routes server-side

export function middleware(req: NextRequest) {
  const token = req.cookies.get("fv_token")?.value;
  const adminKey = req.cookies.get("fv_admin_key")?.value || req.headers.get("x-admin-key");
  const path = req.nextUrl.pathname;

  // Public routes - always allow
  const publicPaths = ["/", "/drop", "/login", "/signup", "/forgot-password", "/reset-password", "/api/auth", "/api/products", "/api/drop"];
  if (publicPaths.some(p => path === p || path.startsWith(p + "/"))) {
    // For /api/products and /api/drop/status, allow public
    if (path.startsWith("/api/products") || path.startsWith("/api/drop/status") || path.startsWith("/api/auth")) {
      return NextResponse.next();
    }
  }

  // Protected: /account requires auth
  if (path.startsWith("/account")) {
    if (!token) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", path);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Protected: /merchant - requires MERCHANT role, but we allow guest to see landing, but dashboard requires auth
  // For /merchant page itself, we allow guest to see pitch but if they try to access merchant dashboard features, API will enforce
  // So middleware allows /merchant but checks token for subpaths if any
  if (path.startsWith("/merchant/dashboard") || path.startsWith("/merchant/orders")) {
    if (!token) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", path);
      url.searchParams.set("role", "merchant");
      return NextResponse.redirect(url);
    }
  }

  // Protected: /admin requires ADMIN or SUPER_ADMIN
  if (path.startsWith("/admin")) {
    // Allow admin page to handle its own auth (supports both JWT and legacy key)
    // But if no token and no admin key, redirect to login? For now allow page to show login
    return NextResponse.next();
  }

  // API protection for admin routes is done in route handlers server-side, not just middleware

  return NextResponse.next();
}

export const config = {
  matcher: ["/account/:path*", "/merchant/:path*", "/admin/:path*", "/api/orders/:path*", "/api/admin/:path*"],
};

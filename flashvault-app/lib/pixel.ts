// Facebook Pixel helpers — safe no-ops when NEXT_PUBLIC_FB_PIXEL_ID is not set.
// Set the env var in Render (BEFORE deploy/build) with your Pixel ID from
// Meta Events Manager, and events start flowing.

export const FB_PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID || "";

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    _fbq?: any;
  }
}

export function fbPixelEnabled(): boolean {
  return !!FB_PIXEL_ID;
}

export function trackEvent(event: string, params: Record<string, unknown> = {}) {
  try {
    if (typeof window !== "undefined" && typeof window.fbq === "function") {
      window.fbq("track", event, params);
    }
  } catch {
    // never break the UI because of analytics
  }
}

export function trackPageView() {
  trackEvent("PageView");
}

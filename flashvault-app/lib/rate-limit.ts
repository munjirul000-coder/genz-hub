// Simple in-memory rate limiter
type Entry = { count: number; resetAt: number };

const store = new Map<string, Entry>();

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, resetIn: windowMs };
  }
  if (entry.count >= limit) {
    return { ok: false, remaining: 0, resetIn: entry.resetAt - now };
  }
  entry.count++;
  return { ok: true, remaining: limit - entry.count, resetIn: entry.resetAt - now };
}

// Cleanup every 5 min
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    store.forEach((v, k) => {
      if (now > v.resetAt) store.delete(k);
    });
  }, 5 * 60 * 1000).unref?.();
}

// REAL viewer tracking — no fake numbers.
// Counts distinct visitors (tabs) seen on any page in the last 90 seconds.
// Each visitor generates a random id once, stored in localStorage, and sends it
// with a lightweight /api/traffic poll. Server keeps id -> lastSeen in memory.
const WINDOW_MS = 90_000;
const PRUNE_EVERY_MS = 30_000;

const viewers = new Map<string, number>();
let lastPrune = 0;

export function markViewer(rawId: string): number {
  const now = Date.now();
  // sanitize: ids are client-generated, keep them short and safe
  const id = rawId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  if (id) viewers.set(id, now);

  if (now - lastPrune > PRUNE_EVERY_MS) {
    lastPrune = now;
    viewers.forEach((ts, k) => {
      if (now - ts > WINDOW_MS) viewers.delete(k);
    });
  }

  return viewerCount(now);
}

export function viewerCount(now = Date.now()): number {
  let n = 0;
  viewers.forEach((ts) => {
    if (now - ts <= WINDOW_MS) n++;
  });
  return n;
}

// client-side helper: stable per-browser viewer id
export function getViewerId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = localStorage.getItem("fv_viewer");
    if (!id) {
      id =
        (window.crypto && typeof window.crypto.randomUUID === "function"
          ? window.crypto.randomUUID()
          : Math.random().toString(36).slice(2) + Date.now().toString(36));
      localStorage.setItem("fv_viewer", id);
    }
    return id;
  } catch {
    return "";
  }
}

/**
 * Simple in-memory sliding-window rate limiter.
 * Known limitation: per server instance (serverless = per warm lambda).
 * Upgrade path if needed: DB-backed counter keyed by key hash.
 */
const hits = new Map<string, number[]>();

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const timestamps = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (timestamps.length >= limit) {
    hits.set(key, timestamps);
    return false;
  }
  timestamps.push(now);
  hits.set(key, timestamps);
  return true;
}

export function resetRateLimit(): void {
  hits.clear();
}

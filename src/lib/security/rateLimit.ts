/**
 * Small fixed-window rate limiter kept in memory.
 *
 * Enough for one server (the Docker / home server setup). If the app ever runs on
 * several instances or serverless workers, swap this for a shared store
 * (Redis, Cloudflare rate limiting, Supabase) behind the same function.
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 50_000;

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  /** Seconds until the window resets. */
  retryAfter: number;
}

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size >= MAX_KEYS) sweep(now);
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  const ok = bucket.count <= limit;
  return {
    ok,
    remaining: Math.max(0, limit - bucket.count),
    retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

function sweep(now: number) {
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  // still full: drop the oldest entries rather than grow without bound
  if (buckets.size >= MAX_KEYS) {
    let n = Math.ceil(MAX_KEYS / 10);
    for (const k of buckets.keys()) {
      if (n-- <= 0) break;
      buckets.delete(k);
    }
  }
}

/** Test helper. */
export function resetRateLimits() {
  buckets.clear();
}

/** Best-effort client address from the reverse proxy headers. */
export function clientIp(headers: Headers): string {
  const cf = headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return headers.get("x-real-ip")?.trim() || "unknown";
}

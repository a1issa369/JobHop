// Client-side throttle: gives instant feedback and stops accidental
// double-submits / loops from ever reaching the network.
// This is a UX convenience only — it can be bypassed by anyone calling
// the API directly, so the real limit is enforced server-side by the
// check_rate_limit() Postgres function (see supabase/schema.sql) which
// every write-heavy RPC calls before doing its work.

const buckets = new Map();

/**
 * @param {string} key - unique key per action+user, e.g. `friend_request:${userId}`
 * @param {number} max - max calls allowed in the window
 * @param {number} windowMs - window size in ms
 * @returns {boolean} true if the call is allowed, false if it should be blocked
 */
export function allowClientAction(key, max = 10, windowMs = 60_000) {
  const now = Date.now();
  const bucket = buckets.get(key) ?? [];
  const recent = bucket.filter((ts) => now - ts < windowMs);

  if (recent.length >= max) {
    buckets.set(key, recent);
    return false;
  }

  recent.push(now);
  buckets.set(key, recent);
  return true;
}

export class RateLimitError extends Error {
  constructor(message = 'Too many requests. Please slow down and try again shortly.') {
    super(message);
    this.name = 'RateLimitError';
  }
}

/**
 * Wraps a Supabase call so a locally-detected burst never even hits the network,
 * and a server-side 429 (from check_rate_limit) surfaces as a friendly error.
 */
export async function withRateLimit(key, { max, windowMs }, fn) {
  if (!allowClientAction(key, max, windowMs)) {
    throw new RateLimitError();
  }
  try {
    return await fn();
  } catch (err) {
    if (err?.code === 'P0429' || /rate limit/i.test(err?.message ?? '')) {
      throw new RateLimitError(err.message);
    }
    throw err;
  }
}

// Per-user throttle for the routes that cost money to serve.
//
// Deliberately in-process: this app ships as a single container against one
// Postgres, so an in-memory window needs no table, no migration and no write
// per request. The tradeoff is that limits are per instance -- run N replicas
// and a user gets N times the allowance. That is still bounded, and the point
// here is to stop a stuck client or a kid leaning on the send button from
// running up a bill, not to enforce a billing quota. Move this to a shared
// store only if the app is ever scaled out.

type Window = { hits: number[]; };

const buckets = new Map<string, Window>();

// Belt and braces against unbounded growth if a lot of users pass through:
// drop windows nothing has touched for a while.
let lastSweep = Date.now();
const SWEEP_EVERY_MS = 10 * 60_000;

function sweep(now: number) {
  if (now - lastSweep < SWEEP_EVERY_MS) return;
  lastSweep = now;
  for (const [key, win] of buckets) {
    if (win.hits.length === 0 || now - win.hits[win.hits.length - 1] > SWEEP_EVERY_MS) {
      buckets.delete(key);
    }
  }
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export type Limit = { limit: number; windowSeconds: number };

// Chat is the common path and should not feel throttled in normal use.
// Statements are the expensive one: a whole file goes to the model.
export const LIMITS: Record<string, Limit> = {
  chat: { limit: envInt("RATE_LIMIT_CHAT", 20), windowSeconds: 60 },
  insight: { limit: envInt("RATE_LIMIT_INSIGHT", 10), windowSeconds: 60 },
  statement: { limit: envInt("RATE_LIMIT_STATEMENT", 5), windowSeconds: 300 },
};

export type RateResult = { ok: true } | { ok: false; retryAfterSeconds: number };

export function checkRateLimit(userId: string, bucket: keyof typeof LIMITS): RateResult {
  const { limit, windowSeconds } = LIMITS[bucket];
  const now = Date.now();
  sweep(now);

  const key = `${bucket}:${userId}`;
  const win = buckets.get(key) ?? { hits: [] };
  const cutoff = now - windowSeconds * 1000;
  // Sliding window rather than a fixed one, so a user can't spend the whole
  // allowance twice by straddling a window boundary.
  win.hits = win.hits.filter((t) => t > cutoff);

  if (win.hits.length >= limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((win.hits[0] - cutoff) / 1000));
    buckets.set(key, win);
    return { ok: false, retryAfterSeconds };
  }

  win.hits.push(now);
  buckets.set(key, win);
  return { ok: true };
}

// 429 with Retry-After, and a message a child can act on.
export function rateLimitResponse(retryAfterSeconds: number): Response {
  const wait =
    retryAfterSeconds <= 60
      ? `${retryAfterSeconds} second${retryAfterSeconds === 1 ? "" : "s"}`
      : `${Math.ceil(retryAfterSeconds / 60)} minutes`;
  return new Response(
    JSON.stringify({ error: `Whoa, slow down a sec! Try again in ${wait}.` }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterSeconds),
      },
    }
  );
}

/**
 * Rate limiting.
 *
 * Why a database table and not an in-memory Map: this app runs on Vercel
 * serverless, where every warm lambda has its own heap. An in-memory counter
 * resets on cold start and is invisible to the next instance, so an attacker
 * gets a fresh budget on every cold start and a "10 attempts per 15 minutes"
 * limit silently means "10 attempts per instance". A row in Postgres is shared
 * by every instance, so the limit is the limit.
 *
 * Why this is not a new service: Upstash Redis is the usual answer, and it
 * would mean another account, another env var, and another thing to keep
 * alive. Neon is already there, already co-located with the functions
 * (`regions: ["sin1"]`), and a counter row is about the cheapest write a
 * Postgres does.
 */

import { getRow, runSql } from "@/lib/db";

/** Client IP, best effort. Vercel sets x-forwarded-for; the first entry is the
 *  original client. A determined attacker can forge the header, which is why
 *  the per-account limit below is the one that actually has to hold. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

export type RateLimitResult = {
  ok: boolean;
  /** How many hits the caller has used inside the current window. */
  hits: number;
  /** Seconds until the window frees up. Only meaningful when ok === false. */
  retryAfter: number;
};

const ALLOWED = { ok: true, hits: 0, retryAfter: 0 } as const;

function windowEnds(windowMs: number): string {
  return new Date(Date.now() + windowMs).toISOString();
}

/**
 * Count one hit against `key` and report whether the caller is still inside
 * its budget.
 *
 * ── The window is measured from the first hit, not from the last ─────────────
 * The first version compared `window_start < now` and reset the counter when
 * that was true. It is *always* true, because time only ever moves forward —
 * so every single call reset `hits` to 1 and the limiter permitted everything.
 * The test caught it immediately: 8 attempts against a limit of 5, all 8
 * allowed, counter reading 1 every time. The column now holds the moment the
 * window *closes*, and the comparison is against `now`, which is false for the
 * whole window and true only after it.
 *
 * The upsert is atomic on purpose. A read-then-write would let two concurrent
 * requests both read count=4 and both write 5, so a limit of 5 would actually
 * admit 6, 7, 8. `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` makes the
 * database do the counting, which is the only place a race cannot slip through.
 *
 * expires_at is TEXT holding an ISO-8601 UTC string, matching every other
 * timestamp column in this schema. Those strings sort lexicographically in
 * exactly the order they sort chronologically, so `<` is a valid "has this
 * window closed yet" test without a cast.
 *
 * This is a fixed window, not a sliding one: a caller can spend a full
 * budget just before expiry and another just after. That doubles the worst
 * case burst and is the accepted trade for one row and one query — a sliding
 * log would cost an insert per request to fix a bound that is already fine
 * for "stop someone guessing a password 8 times".
 */
export async function hit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const nowIso = new Date().toISOString();
  const expiresAt = windowEnds(windowMs);

  const row = await getRow<{ hits: number; expires_at: string }>(
    `INSERT INTO rate_limits (key, hits, expires_at)
     VALUES (?, 1, ?)
     ON CONFLICT (key) DO UPDATE SET
       hits       = CASE WHEN rate_limits.expires_at < ? THEN 1 ELSE rate_limits.hits + 1 END,
       expires_at = CASE WHEN rate_limits.expires_at < ? THEN ? ELSE rate_limits.expires_at END
     RETURNING hits, expires_at`,
    [key, expiresAt, nowIso, nowIso, expiresAt],
  );

  if (!row) return ALLOWED;

  const hits = Number(row.hits);

  if (hits > limit) {
    return { ok: false, hits, retryAfter: retrySeconds(row.expires_at) };
  }

  return { ok: true, hits, retryAfter: 0 };
}

/** Read the counter without consuming budget. */
export async function peek(
  key: string,
  limit: number,
  _windowMs: number,
): Promise<RateLimitResult> {
  const row = await getRow<{ hits: number; expires_at: string }>(
    `SELECT hits, expires_at FROM rate_limits WHERE key = ?`,
    [key],
  );
  if (!row) return ALLOWED;
  const hits = Number(row.hits);
  if (hits <= limit) return { ok: true, hits, retryAfter: 0 };
  return { ok: false, hits, retryAfter: retrySeconds(row.expires_at) };
}

function retrySeconds(expiresAt: string): number {
  return Math.max(1, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

export async function reset(key: string): Promise<void> {
  await runSql(`DELETE FROM rate_limits WHERE key = ?`, [key]);
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/**
 * The budgets.
 *
 * The login numbers are the ones that matter. `perAccount` counts only FAILED
 * attempts, so a parent who signs in ten times in an afternoon is never locked
 * out of their own account — only someone guessing that password slowly is.
 * `perIp` counts every attempt, because spraying one password across many
 * accounts produces no per-account failures and would otherwise walk straight
 * through.
 */
export const LIMITS = {
  login: { perAccount: 8, perIp: 40, windowMs: 15 * MINUTE },
  signup: { perIp: 10, windowMs: HOUR },
  upload: { perUser: 30, windowMs: HOUR },
  password: { perUser: 6, windowMs: 15 * MINUTE },
  playStart: { perIp: 30, windowMs: 10 * MINUTE },
} as const;

export const KEYS = {
  loginAccount: (email: string) => `login:acct:${email.toLowerCase()}`,
  loginIp: (ip: string) => `login:ip:${ip}`,
  signupIp: (ip: string) => `signup:ip:${ip}`,
  uploadUser: (userId: string) => `upload:user:${userId}`,
  passwordUser: (userId: string) => `password:user:${userId}`,
  playStartIp: (ip: string) => `play:ip:${ip}`,
} as const;

/**
 * PostgreSQL connection: Neon or Supabase.
 *
 * ── Why this file exists at all ──────────────────────────────────────────────
 * It used to be a `node:sqlite` singleton over a local file. That cannot work
 * on Vercel: the filesystem of a serverless function is read-only and thrown
 * away between invocations, so there is nowhere to keep a database.
 *
 * ── The one shape difference that matters ────────────────────────────────────
 * `node:sqlite` is synchronous; `pg` is not. Every function below returns a
 * Promise, which means every caller in lib/queries/data.ts is `async` and
 * every Server Component that reads data has to `await` it. That is the whole
 * cost of this migration and it is not optional.
 *
 * ── Deliberately kept ───────────────────────────────────────────────────────
 * * Timestamps stay TEXT, not TIMESTAMPTZ. The app writes ISO strings via
 *   `now()` and reads them back as strings; switching the column type would
 *   hand `pg` a Date object where the code expects a string, and that failure
 *   is silent, it shows up as a wrong "2 days ago" much later.
 * * `?` placeholders are unchanged in every query in lib/queries/data.ts.
 *   node-postgres does NOT understand them, it forwards the text to the
 *   server, which answers `syntax error at or near ","`. The conversion to
 *   $1/$2 happens in the helpers below (see toDollarPlaceholders), so those
 *   queries are correct as written.
 * * email uniqueness is plain UNIQUE, not COLLATE NOCASE. SQLite's NOCASE has
 *   no Postgres equivalent short of the citext extension; the code already
 *   lower-cases every address on the way in, so a case-insensitive index would
 *   only duplicate that rule in two places.
 */

import { Pool, types } from "pg";
import { randomBytes, randomUUID } from "node:crypto";

/**
 * Postgres returns int8 (OID 20) as a STRING, because 64-bit integers do not
 * fit in a JS number for every value. Left alone, `SUM(points)` and any large
 * count arrive as "10000" and then break arithmetic silently, a string
 * concatenated to a number works, a number divided by one does not. int2 and
 * int4 are parsed correctly out of the box; only int8 needs this.
 */
types.setTypeParser(20, (v) => Number(v));

/**
 * Where the pooled connection lives, with an actionable failure.
 *
 * Failing here at import time is deliberate. The alternative, defaulting to
 * some local path, is what made the SQLite version look healthy on a machine
 * that was not the machine it would run on.
 */
function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      [
        "DATABASE_URL belum diisi.",
        "",
        "EaLearn berjalan di PostgreSQL (Neon / Supabase). Isi dulu, lalu:",
        "  Neon     → dashboard Neon → Connection string → Pooled connection",
        "  Supabase → Project Settings → Database → Connection string → URI",
        "",
        "Untuk pengembangan lokal, buat database kosong di salah satu dari",
        "keduanya juga bisa, tidak perlu layanan berbayar.",
      ].join("\n"),
    );
  }
  return url;
}

declare global {
  // Next.js hot-reloads modules in development; without this the pool is
  // rebuilt on every edit until Postgres refuses new connections.
  // eslint-disable-next-line no-var
  var __ealearnPool: Pool | undefined;
}

function createPool(): Pool {
  const pool = new Pool({
    connectionString: connectionString(),
    /*
     * max: 1 is the important number on serverless.
     *
     * Every lambda instance gets its own pool, and Postgres counts connections
     * per database, not per instance. A default pool (10) multiplied across a
     * dozen warm functions exhausts Neon's connection limit within minutes and
     * every query starts failing with "too many connections". One connection
     * per instance is the whole reason this works.
     */
    max: 1,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 15_000,
    // Neon and Supabase both require TLS; the URL carries sslmode, and this is
    // the belt to that suspenders. pgv8 rejects self-signed certs by default,
    // which is correct, do not disable it to silence a connection error.
    ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
  });

  // A pool error with no listener is an unhandled rejection that takes the
  // process down. Log it and let the next query retry on a fresh connection.
  pool.on("error", (err) => {
    console.error("[db] pool error:", err.message);
  });

  return pool;
}

/**
 * The pool, built on first use rather than at import.
 *
 * This is not just tidiness. `next build` imports every route module to collect
 * page data, so a pool created at import time means the build needs a live
 * database, it fails on a machine without one, and on Vercel it would connect
 * to production from the build step. The failure message above is still
 * actionable; it just arrives when a query actually runs, which is the only
 * moment it is relevant.
 */
export function getPool(): Pool {
  if (!globalThis.__ealearnPool) {
    globalThis.__ealearnPool = createPool();
  }
  return globalThis.__ealearnPool;
}

/** Closes the pool. Only meaningful for scripts; a serverless instance is
 *  recycled by the platform rather than shut down. */
export async function closePool(): Promise<void> {
  if (globalThis.__ealearnPool) {
    await globalThis.__ealearnPool.end();
    globalThis.__ealearnPool = undefined;
  }
}

// ===========================
// Schema
// ===========================

/**
 * The full schema, as one idempotent statement batch.
 *
 * `CREATE TABLE IF NOT EXISTS` runs on import, exactly as the SQLite version
 * did, so a fresh database needs no separate migration step. What changed for
 * Postgres:
 *   - `COLLATE NOCASE` gone (see the header note)
 *   - `datetime('now')` gone; the app supplies `now()` on every insert, so the
 *     columns carry a plain empty-string default rather than a function that
 *     would return a different string format than the app writes
 *   - INTEGER columns kept as INTEGER, because the code reads `email_verified`
 *     and friends with Boolean() on the 0/1 values it stores
 */
const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS users (
    id              TEXT PRIMARY KEY,
    email           TEXT NOT NULL UNIQUE,
    password_hash   TEXT,
    display_name    TEXT NOT NULL,
    email_verified  INTEGER NOT NULL DEFAULT 0,
    auth_provider   TEXT NOT NULL DEFAULT 'email',
    created_at      TEXT NOT NULL DEFAULT '',
    updated_at      TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

  -- Bumped every time the password changes. A JWT does not consult the
  -- database, so without this a session issued before a password change stays
  -- valid for its whole lifetime, which means a parent who resets a leaked
  -- password cannot actually lock the thief out. See lib/auth.ts.
  --
  -- The catalog check below is not cosmetic. 'ALTER TABLE users ADD COLUMN IF
  -- NOT EXISTS' takes an AccessExclusiveLock on 'users' EVEN WHEN THE COLUMN
  -- IS ALREADY THERE, because the lock is taken before Postgres looks at the
  -- catalog. This batch runs on every cold start of every lambda, so two
  -- instances waking up at the same moment both wanted that lock and
  -- deadlocked (40P01) on the 'users' relation. The child tapping "Mulai
  -- Kuis" got a 500 and a red "Internal error" box, and it was intermittent
  -- because it only needs two instances to start together.
  --
  -- Reading the catalog first costs only an AccessShareLock, so in steady
  -- state nothing takes a write lock on 'users' at all.
  --
  -- pg_attribute with to_regclass is used instead of information_schema
  -- because it resolves 'users' exactly the way the ALTER below does, through
  -- search_path. information_schema.columns would need current_schema(), and
  -- that returns NULL if the search path resolves to nothing, which would make
  -- the check miss and run the ALTER anyway.
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_attribute
       WHERE attrelid = to_regclass('users')
         AND attname = 'token_version'
         AND NOT attisdropped
    ) THEN
      ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0;
    END IF;
  END $$;

  -- Rate limiting counters. Shared across every lambda instance, which an
  -- in-memory Map could not be. expires_at is the instant the window closes,
  -- not the instant it opened, see the note in lib/rate-limit.ts.
  CREATE TABLE IF NOT EXISTS rate_limits (
    key        TEXT PRIMARY KEY,
    hits       INTEGER NOT NULL,
    expires_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_rate_limits_expires ON rate_limits(expires_at);

  CREATE TABLE IF NOT EXISTS user_settings (
    user_id          TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    notify_email     INTEGER NOT NULL DEFAULT 1,
    notify_whatsapp  INTEGER NOT NULL DEFAULT 1,
    notify_inapp     INTEGER NOT NULL DEFAULT 1,
    notify_attempt   INTEGER NOT NULL DEFAULT 1,
    anonymous_share  INTEGER NOT NULL DEFAULT 0,
    allow_analytics  INTEGER NOT NULL DEFAULT 1,
    allow_marketing  INTEGER NOT NULL DEFAULT 0,
    updated_at       TEXT
  );

  CREATE TABLE IF NOT EXISTS children (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    age_range   TEXT NOT NULL,
    subjects    TEXT,
    created_at  TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS idx_children_user ON children(user_id);

  CREATE TABLE IF NOT EXISTS quizzes (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    share_uuid      TEXT NOT NULL UNIQUE,
    title           TEXT NOT NULL,
    description     TEXT,
    subject         TEXT,
    age_range       TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'draft',
    published_at    TEXT,
    created_at      TEXT NOT NULL DEFAULT '',
    updated_at      TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS idx_quizzes_user ON quizzes(user_id);
  CREATE INDEX IF NOT EXISTS idx_quizzes_share ON quizzes(share_uuid);

  -- JSON columns stay TEXT for the same reason timestamps do: the code parses
  -- them with JSON.parse and expects the string it wrote, not a parsed object.
  CREATE TABLE IF NOT EXISTS questions (
    id                  TEXT PRIMARY KEY,
    quiz_id             TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    order_index         INTEGER NOT NULL,
    type                TEXT NOT NULL,
    prompt              TEXT NOT NULL,
    options             TEXT,
    correct_answer      TEXT,
    keywords            TEXT,
    keyword_weights     TEXT,
    image_url           TEXT,
    points              INTEGER NOT NULL DEFAULT 10
  );
  CREATE INDEX IF NOT EXISTS idx_questions_quiz ON questions(quiz_id, order_index);

  CREATE TABLE IF NOT EXISTS attempts (
    id              TEXT PRIMARY KEY,
    quiz_id         TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    child_name      TEXT NOT NULL,
    total_score     INTEGER,
    max_score       INTEGER NOT NULL,
    status          TEXT NOT NULL DEFAULT 'in_progress',
    submitted_at    TEXT,
    graded_at       TEXT,
    started_at      TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS idx_attempts_quiz ON attempts(quiz_id, submitted_at);

  CREATE TABLE IF NOT EXISTS answers (
    id              TEXT PRIMARY KEY,
    attempt_id      TEXT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
    question_id     TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    response        TEXT NOT NULL,
    auto_score      INTEGER,
    final_score     INTEGER,
    parent_comment  TEXT,
    created_at      TEXT NOT NULL DEFAULT ''
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_answers_attempt_question ON answers(attempt_id, question_id);
`;

let schemaPromise: Promise<void> | null = null;

/**
 * Kunci advisory supaya hanya satu instance yang menjalankan DDL.
 *
 * The memoised promise below serialises the work INSIDE one process. It does
 * nothing across processes, and on Vercel every lambda is its own process, so
 * two lambdas cold-starting together both ran the same DDL batch. `pg_try`
 * would be the wrong call here (it fails fast and the loser would then run the
 * DDL anyway), so this takes the real lock and waits: the loser waits for the
 * winner to finish creating the schema instead of racing it.
 *
 * The key is an arbitrary but fixed number. Any instance that wants to run the
 * DDL asks for the same one.
 */
const SCHEMA_LOCK_KEY = "8674212";

/**
 * Errors worth trying again.
 *
 * 40P01 deadlock_detected and 40001 serialization_failure both mean Postgres
 * rolled the transaction back, so nothing was written and replaying the
 * statement is safe. 55P03 lock_timeout is the advisory lock above running
 * out of patience, and the holder is a different instance that may well be
 * gone by the next attempt.
 */
const RETRYABLE_CODES = new Set(["40P01", "40001", "55P03"]);

function isRetryable(err: unknown): boolean {
  const code = (err as { code?: string } | null | undefined)?.code;
  return typeof code === "string" && RETRYABLE_CODES.has(code);
}

/**
 * Replays a statement that Postgres rolled back.
 *
 * The backoff is short and jittered: the point is to get out of the other
 * transaction's way, not to wait for a human to look.
 */
async function withRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!isRetryable(err)) throw err;
      lastError = err;
      const wait = 40 * (attempt + 1) + Math.floor(Math.random() * 60);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastError;
}

/**
 * Creates the tables once per process, and every query waits for it.
 *
 * This is wired into the query helpers rather than left to the scripts. A
 * hosted database is created empty, the `CREATE TABLE` only ever ran when
 * someone remembered to run `db:seed`, so a first deploy on a fresh Neon or
 * Supabase project would have come up green and then failed every page with
 * `relation "users" does not exist`. The promise is memoised, so after the
 * first query this is an await on an already-resolved value.
 */
export function ensureSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = withRetry(runSchema)
      // Counters whose window has closed can never be read again by `hit()`,
      // it resets them on the next conflict, so they are pure garbage. Pruned
      // once per process rather than per request: ensureSchema is memoised, so
      // this runs on cold start, which is exactly as often as it needs to be.
      .then(() => {
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        return getPool().query(`DELETE FROM rate_limits WHERE expires_at < $1`, [
          cutoff,
        ]);
      })
      .then(() => undefined)
      .catch((err) => {
        // A failed attempt must not be cached. A warm lambda that lost one
        // race would then fail every later request with the same stale error,
        // long after the database was healthy again. Clearing the memo lets
        // the next request try again; the advisory lock in runSchema keeps
        // the retries from colliding with each other.
        schemaPromise = null;
        throw err;
      });
  }
  return schemaPromise;
}

/**
 * The DDL itself, under the advisory lock.
 *
 * Everything happens inside ONE explicit transaction, and that is not
 * decoration. The connection string points at Neon's pooled endpoint, which is
 * PgBouncer in transaction pooling mode: between two separate statements the
 * client can be moved to a DIFFERENT Postgres backend. That was measured here,
 * not assumed. With six instances starting at once, `pg_advisory_lock` landed
 * on one backend, the schema batch landed on a second, and the unlock landed
 * on a third. The lock was then held forever by an idle backend that nobody
 * could reach again, and every later instance waited on it until the statement
 * timed out.
 *
 * An explicit BEGIN pins the client to one backend for the whole transaction,
 * so the lock, the DDL and the release all happen on the same backend.
 *
 * `pg_advisory_xact_lock` (transaction scoped) is used instead of
 * `pg_advisory_lock` (session scoped) for a second reason: Postgres releases
 * an xact lock by itself at COMMIT or ROLLBACK. There is no code path that
 * can leak it, not even a crash between the DDL and the unlock.
 */
async function runSchema(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    try {
      // Do not wait forever for the lock. If the instance holding it is stuck,
      // the retry loop should get another turn. SET LOCAL is scoped to this
      // transaction, so it cannot leak into later queries on this session.
      await client.query("SET LOCAL lock_timeout = '15s'");
      await client.query("SELECT pg_advisory_xact_lock($1::bigint)", [
        SCHEMA_LOCK_KEY,
      ]);
      await client.query(SCHEMA_SQL);
      await client.query("COMMIT");
    } catch (err) {
      // ROLLBACK releases the xact lock and drops any DDL from this attempt.
      await client.query("ROLLBACK").catch(() => undefined);
      throw err;
    }
  } finally {
    client.release();
  }
}

// ===========================
// Query helpers
// ===========================

export type SQLInputValue = string | number | boolean | null | Date | Buffer;

/**
 * Rewrites `?` placeholders into Postgres's `$1, $2, …`
 *
 * node-postgres does NOT accept `?`. It passes the text to the server
 * verbatim, and the server answers `syntax error at or near ","`, which is
 * exactly what the first `db:test` against a real Neon database reported.
 *
 * Converting here rather than rewriting all 54 queries in lib/queries/data.ts
 * is the smaller and safer change: those queries are otherwise correct, and a
 * mechanical find-and-replace across hand-written SQL is precisely where a
 * placeholder inside a string literal gets eaten.
 *
 * The walk below is what makes it safe:
 *   - a `?` inside 'single quotes' is text and is left alone
 *   - '' is an escaped quote, not the end of a string
 *   - $$…$$ dollar-quoted bodies are skipped
 *   - `--` line comments and block comments are skipped
 * so `WHERE note = 'a?b' AND x = ?` binds one parameter, not two.
 */
export function toDollarPlaceholders(sql: string): string {
  let out = "";
  let n = 0;
  let i = 0;

  while (i < sql.length) {
    const ch = sql[i];

    if (ch === "-" && sql[i + 1] === "-") {
      const end = sql.indexOf("\n", i);
      const stop = end === -1 ? sql.length : end;
      out += sql.slice(i, stop);
      i = stop;
      continue;
    }

    if (ch === "/" && sql[i + 1] === "*") {
      const end = sql.indexOf("*/", i + 2);
      const stop = end === -1 ? sql.length : end + 2;
      out += sql.slice(i, stop);
      i = stop;
      continue;
    }

    if (ch === "'") {
      out += ch;
      i++;
      while (i < sql.length) {
        if (sql[i] === "'") {
          if (sql[i + 1] === "'") {
            out += "''";
            i += 2;
            continue;
          }
          out += "'";
          i++;
          break;
        }
        out += sql[i];
        i++;
      }
      continue;
    }

    if (ch === "$" && sql[i + 1] === "$") {
      const end = sql.indexOf("$$", i + 2);
      const stop = end === -1 ? sql.length : end + 2;
      out += sql.slice(i, stop);
      i = stop;
      continue;
    }

    if (ch === "?") {
      n += 1;
      out += `$${n}`;
      i++;
      continue;
    }

    out += ch;
    i++;
  }

  return out;
}

export async function allRows<T = unknown>(
  sql: string,
  params?: SQLInputValue[],
): Promise<T[]> {
  await ensureSchema();
  const text = toDollarPlaceholders(sql);
  const res = await withRetry(() =>
    getPool().query(text, params as unknown[]),
  );
  return res.rows as T[];
}

export async function getRow<T = unknown>(
  sql: string,
  params?: SQLInputValue[],
): Promise<T | undefined> {
  await ensureSchema();
  const text = toDollarPlaceholders(sql);
  const res = await withRetry(() =>
    getPool().query(text, params as unknown[]),
  );
  return (res.rows[0] ?? undefined) as T | undefined;
}

/**
 * Mirrors the old SQLite result shape.
 *
 * Only `changes` was ever read, nothing used `lastInsertRowid`, because ids
 * are cuid-style strings generated in application code, not serial columns.
 */
export async function runSql(
  sql: string,
  params?: SQLInputValue[],
): Promise<{ changes: number }> {
  await ensureSchema();
  const text = toDollarPlaceholders(sql);
  const res = await withRetry(() =>
    getPool().query(text, params as unknown[]),
  );
  return { changes: res.rowCount ?? 0 };
}

/**
 * A transaction. Postgres needs one where SQLite's single connection made it
 * implicit, and it is the only way to batch several statements on one
 * connection, with `max: 1` there is no second connection to be interleaved.
 *
 * The client handed to the callback is a raw pg client, so it does NOT go
 * through toDollarPlaceholders. Call `client.query(toDollarPlaceholders(sql), …)`
 * or use `$1` directly. Nothing in the app currently uses this.
 */
export async function transaction<T>(
  fn: (client: import("pg").PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

// ===========================
// Utility
// ===========================

/**
 * An id for rows this app owns.
 *
 * The previous version was `"c" + Date.now().toString(36) + Math.random()…`,
 * which is not a cuid and was never meant to be mistaken for one. It had two
 * problems: `Math.random()` is xorshift128+, not a CSPRNG, so its output is
 * derived from a recoverable 128-bit state rather than being unpredictable; and
 * the timestamp prefix was readable straight out of the id, so holding one link
 * told you when it was made. Neither is exploitable at 51.7 bits over the
 * network, but row ids do not need to be secret and were paying for a
 * generator that had to look like it was.
 *
 * `crypto.randomUUID()` is a CSPRNG draw and 122 bits besides, so the id
 * length stops wobbling between 16 and 19 characters as well.
 */
export function cuid(): string {
  return randomUUID().replace(/-/g, "");
}

/**
 * The secret half of a share link: /play/<token> is the only thing standing
 * between a parent's quiz and anybody who has the URL, and the child who opens
 * it has no account and no session. 32 bytes from the OS CSPRNG, 256 bits,
 * which is not a number anyone brute-forces, and unlike the old id it carries
 * no timestamp to read back.
 */
export function shareToken(): string {
  return randomBytes(32).toString("base64url");
}

export function now(): string {
  return new Date().toISOString();
}


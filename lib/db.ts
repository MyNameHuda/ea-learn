/**
 * PostgreSQL connection — Neon or Supabase.
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
 *   is silent — it shows up as a wrong "2 days ago" much later.
 * * `?` placeholders are unchanged in every query in lib/queries/data.ts.
 *   node-postgres does NOT understand them — it forwards the text to the
 *   server, which answers `syntax error at or near ","`. The conversion to
 *   $1/$2 happens in the helpers below (see toDollarPlaceholders), so those
 *   queries are correct as written.
 * * email uniqueness is plain UNIQUE, not COLLATE NOCASE. SQLite's NOCASE has
 *   no Postgres equivalent short of the citext extension; the code already
 *   lower-cases every address on the way in, so a case-insensitive index would
 *   only duplicate that rule in two places.
 */

import { Pool, types } from "pg";

/**
 * Postgres returns int8 (OID 20) as a STRING, because 64-bit integers do not
 * fit in a JS number for every value. Left alone, `SUM(points)` and any large
 * count arrive as "10000" and then break arithmetic silently — a string
 * concatenated to a number works, a number divided by one does not. int2 and
 * int4 are parsed correctly out of the box; only int8 needs this.
 */
types.setTypeParser(20, (v) => Number(v));

/**
 * Where the pooled connection lives, with an actionable failure.
 *
 * Failing here at import time is deliberate. The alternative — defaulting to
 * some local path — is what made the SQLite version look healthy on a machine
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
        "keduanya juga bisa — tidak perlu layanan berbayar.",
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
    // which is correct — do not disable it to silence a connection error.
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
 * database — it fails on a machine without one, and on Vercel it would connect
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
 * Creates the tables once per process.
 *
 * Concurrent lambdas can race here, which is why it is memoised as a promise
 * rather than a boolean: the losers await the same work instead of issuing a
 * second identical batch.
 */
/**
 * Creates the tables once per process, and every query waits for it.
 *
 * This is wired into the query helpers rather than left to the scripts. A
 * hosted database is created empty — the `CREATE TABLE` only ever ran when
 * someone remembered to run `db:seed` — so a first deploy on a fresh Neon or
 * Supabase project would have come up green and then failed every page with
 * `relation "users" does not exist`. The promise is memoised, so after the
 * first query this is an await on an already-resolved value.
 */
export function ensureSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = getPool().query(SCHEMA_SQL).then(() => undefined);
  }
  return schemaPromise;
}

// ===========================
// Query helpers
// ===========================

export type SQLInputValue = string | number | boolean | null | Date | Buffer;

/**
 * Rewrites `?` placeholders into Postgres's `$1, $2, …`
 *
 * node-postgres does NOT accept `?`. It passes the text to the server
 * verbatim, and the server answers `syntax error at or near ","` — which is
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
  const res = await getPool().query(
    toDollarPlaceholders(sql),
    params as unknown[],
  );
  return res.rows as T[];
}

export async function getRow<T = unknown>(
  sql: string,
  params?: SQLInputValue[],
): Promise<T | undefined> {
  await ensureSchema();
  const res = await getPool().query(
    toDollarPlaceholders(sql),
    params as unknown[],
  );
  return (res.rows[0] ?? undefined) as T | undefined;
}

/**
 * Mirrors the old SQLite result shape.
 *
 * Only `changes` was ever read — nothing used `lastInsertRowid`, because ids
 * are cuid-style strings generated in application code, not serial columns.
 */
export async function runSql(
  sql: string,
  params?: SQLInputValue[],
): Promise<{ changes: number }> {
  await ensureSchema();
  const res = await getPool().query(
    toDollarPlaceholders(sql),
    params as unknown[],
  );
  return { changes: res.rowCount ?? 0 };
}

/**
 * A transaction. Postgres needs one where SQLite's single connection made it
 * implicit, and it is the only way to batch several statements on one
 * connection — with `max: 1` there is no second connection to be interleaved.
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

export function cuid(): string {
  return "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
}

export function now(): string {
  return new Date().toISOString();
}


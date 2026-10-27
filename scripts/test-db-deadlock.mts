/**
 * Test: ensureSchema() tidak boleh deadock saat beberapa instance start bareng.
 *
 * Latar belakang. Di production, anak mengetik namanya lalu menekan "Mulai
 * Kuis" dan dapat kotak merah "Internal error". Log Vercel menunjuk
 * `40P01 deadlock detected`, `AccessExclusiveLock on relation 16564`, dan
 * relation itu adalah tabel `users`.
 *
 * Sebabnya: `ensureSchema()` menjalankan DDL setiap kali proses baru bangun.
 * Di dalam batch itu ada `ALTER TABLE users ADD COLUMN IF NOT EXISTS`, dan
 * ALTER TABLE mengambil AccessExclusiveLock ke `users` BAHKAN KOLOMNYA SUDAH
 * ADA, karena lock diambil sebelum Postgres membaca katalog. Dua instance
 * yang bangun bersamaan sama-sama mau lock itu, lalu saling menunggu.
 *
 * Test ini menjalankan ensureSchema() sungguhan dari beberapa PROSES terpisah
 * (memoisasi di dalam lib/db.ts cuma berlaku per-proses, jadi tiap proses
 * baru benar-benar menjalankan DDL-nya, seperti lambda Vercel yang berbeda).
 * Kalau muncul deadlock, test gagal.
 *
 * Test ini juga menjaga dua hal yang hanya terlihat kalau dilihat ke database:
 *   1. tidak ada advisory lock yang tertinggal setelah semua worker selesai
 *   2. setiap worker masih bisa query setelah DDL-nya selesai
 *
 * Run: npm run test:db
 *      BASE_URL tidak dipakai; yang dipakai adalah DATABASE_URL.
 */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Client } from "pg";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const SELF = resolve(HERE, "test-db-deadlock.mts");
const WORKERS = Number(process.env.DEADLOCK_WORKERS ?? 6);
const ROUNDS = Number(process.env.DEADLOCK_ROUNDS ?? 2);

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (ok) {
    pass++;
    console.log(`  PASS  ${name}${detail ? "  " + detail : ""}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}${detail ? "  " + detail : ""}`);
  }
};

// Mode worker: proses anak yang benar-benar menjalankan ensureSchema().
if (process.env.EALearn_SCHEMA_WORKER === "1") {
  const { ensureSchema, getRow, closePool } = await import("../lib/db");
  try {
    await ensureSchema();
    // Query setelah DDL: membuktikan schema benar-benar bisa dipakai dan
    // koneksi di pool masih hidup setelah transaksi DDL selesai.
    const row = await getRow<{ n: number }>("select count(*)::int as n from users");
    console.log(`WORKER_OK users=${row?.n ?? -1}`);
  } catch (e) {
    const code = (e as { code?: string })?.code ?? "NO_CODE";
    console.log(`WORKER_FAIL ${code} ${String((e as Error)?.message ?? e).split("\n")[0]}`);
    await closePool().catch(() => undefined);
    process.exit(1);
  }
  await closePool().catch(() => undefined);
  process.exit(0);
}

function runWorker(): Promise<{ code: string; out: string }> {
  return new Promise((res) => {
    const child = spawn(
      process.execPath,
      ["--env-file=.env", "--import", "tsx", SELF],
      {
        cwd: ROOT,
        env: { ...process.env, EALearn_SCHEMA_WORKER: "1" },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let out = "";
    child.stdout.on("data", (d) => {
      out += String(d);
    });
    child.stderr.on("data", (d) => {
      out += String(d);
    });
    child.on("close", () => {
      const m = out.match(/WORKER_(OK|FAIL)\s*(\S*)?/);
      res({ code: m?.[1] === "OK" ? "OK" : (m?.[2] ?? "UNKNOWN"), out: out.trim() });
    });
  });
}

console.log(`workers=${WORKERS} rounds=${ROUNDS}\n`);

console.log("=== 1. sumber: tidak boleh ada ALTER TABLE tanpa guard ===");
{
  const src = readFileSync(resolve(ROOT, "lib/db.ts"), "utf8");
  const unguarded = /ALTER\s+TABLE\s+users\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS/i.test(src);
  check(
    "tidak ada ALTER TABLE users ADD COLUMN IF NOT EXISTS tanpa guard",
    !unguarded,
    unguarded ? "masih ada, ini yang ambil AccessExclusiveLock tiap cold start" : "",
  );
  check(
    "ada cek katalog sebelum ALTER",
    /pg_attribute/i.test(src) || /information_schema\.columns/i.test(src),
  );
  check("ada retry untuk 40P01", /40P01/.test(src));

  // Kunci advisory harus di dalam transaksi eksplisit di DALAM runSchema.
  // DATABASE_URL memakai endpoint pooled Neon (PgBouncer transaction pooling),
  // jadi dua statement berurutan bisa berakhir di backend yang BERBEDA.
  // Tanpa transaksi eksplisit, lock bisa diambil di satu backend dan dilepas
  // di backend lain, sehingga lock-nya tertinggal selamanya. Ini diukur, bukan
  // asumsi.
  //
  // Dicek pada body runSchema saja, bukan seluruh file: helper runSql juga
  // punya BEGIN/COMMIT untuk hal lain, dan cek di seluruh file akan lolos
  // palsu pada kode yang justru bocor.
  const runSchemaBody = (() => {
    const start = src.search(/async\s+function\s+runSchema\s*\(/);
    if (start < 0) return "";
    const after = src.slice(start + 1);
    const end = after.search(/\n(?:export\s+)?(?:async\s+)?function\s/);
    return end < 0 ? src.slice(start) : src.slice(start, start + 1 + end);
  })();
  const iBegin = runSchemaBody.search(/["'`]\s*BEGIN\s*["'`]/i);
  const iLock = runSchemaBody.search(/pg_advisory_xact_lock/i);
  const iCommit = runSchemaBody.search(/["'`]\s*COMMIT\s*["'`]/i);
  const iRollback = runSchemaBody.search(/["'`]\s*ROLLBACK\s*["'`]/i);

  check(
    "runSchema memakai transaksi eksplisit",
    iBegin >= 0 && iCommit >= 0 && iRollback >= 0,
    iBegin < 0 ? "tidak ada BEGIN di runSchema" : "",
  );
  check(
    "kunci advisory diambil DI DALAM transaksi (BEGIN < lock < COMMIT)",
    iBegin >= 0 && iLock > iBegin && iCommit > iLock,
    iLock <= iBegin ? "lock diambil sebelum BEGIN, jadi di luar transaksi" : "",
  );
  check(
    "pakai pg_advisory_xact_lock (auto-lepas di COMMIT/ROLLBACK)",
    iLock >= 0,
    iLock < 0 ? "pg_advisory_lock session-level bisa bocor" : "",
  );
  check(
    "tidak ada pg_advisory_unlock_all (session-level, bisa bocor)",
    !/pg_advisory_unlock_all/.test(src),
  );
  check(
    "lock_timeout pakai SET LOCAL, tidak sticky per session",
    /SET\s+LOCAL\s+lock_timeout/i.test(src) && !/SET\s+lock_timeout\s*=/i.test(src),
  );
}

console.log("\n=== 2. beberapa proses menjalankan ensureSchema() bareng ===");
for (let round = 1; round <= ROUNDS; round++) {
  const results = await Promise.all(Array.from({ length: WORKERS }, () => runWorker()));
  const bad = results.filter((r) => r.code !== "OK");
  const deadlock = bad.filter((r) => r.code === "40P01" || r.code === "40001");
  const other = bad.filter((r) => r.code !== "40P01" && r.code !== "40001");

  check(
    `ronde ${round}: semua worker selesai tanpa deadlock`,
    deadlock.length === 0,
    deadlock.length ? `${deadlock.length} worker kena 40P01/40001` : "",
  );
  check(
    `ronde ${round}: tidak ada error lain`,
    other.length === 0,
    other.length ? other.map((o) => `${o.code}: ${o.out.slice(0, 160)}`).join(" | ") : "",
  );
  if (bad.length) {
    for (const b of bad) console.log(`      worker: ${b.code}  ${b.out.slice(0, 300)}`);
  }
}

console.log("\n=== 3. tidak ada advisory lock yang tertinggal ===");
{
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  const held = await client.query(
    `select count(*)::int as n
       from pg_locks
      where locktype = 'advisory' and granted`,
  );
  const waiting = await client.query(
    `select count(*)::int as n
       from pg_stat_activity
      where wait_event_type = 'Lock' and wait_event = 'advisory'`,
  );
  check(
    "tidak ada advisory lock yang masih dipegang",
    held.rows[0].n === 0,
    held.rows[0].n ? `${held.rows[0].n} lock nyangkut` : "",
  );
  check(
    "tidak ada session yang masih menunggu advisory lock",
    waiting.rows[0].n === 0,
    waiting.rows[0].n ? `${waiting.rows[0].n} session menunggu` : "",
  );
  await client.end();
}

console.log(
  `\n=== ${fail === 0 ? "SEMUA LOLOS" : fail + " GAGAL"}: ${pass} pass, ${fail} fail ===`,
);
process.exit(fail === 0 ? 0 : 1);

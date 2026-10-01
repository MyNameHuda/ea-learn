// One-off: prove DATABASE_URL points at a working PostgreSQL database.
// Run: npm run db:test
//
// This exists because the failure mode of a wrong connection string is a
// timeout that looks like "the site is just slow", and because the pool is
// built with max:1 — a settings mistake there does not show up until the
// eleventh concurrent request. Both of those are worth catching before deploy.

import { closePool, ensureSchema, allRows, getPool, runSql, getRow } from "../lib/db";

// Everything is inside main() because tsx compiles these to CommonJS (there is
// no "type": "module" in package.json) and top-level await is not available in
// that output format. Every other script here uses the same shape.
async function main() {
  const results: { ok: boolean; name: string; detail: string }[] = [];
  const check = async (name: string, fn: () => Promise<string>) => {
    try {
      results.push({ ok: true, name, detail: await fn() });
    } catch (e) {
      results.push({ ok: false, name, detail: String((e as Error).message).slice(0, 300) });
    }
  };

  console.log("\n=== Uji koneksi database ===\n");
  const host = (() => {
    try {
      return new URL(process.env.DATABASE_URL ?? "").host;
    } catch {
      return "(tidak terbaca — DATABASE_URL kosong?)";
    }
  })();
  console.log(`host: ${host}\n`);

  await check("koneksi", async () => {
    const r = await getPool().query("SELECT version()");
    return r.rows[0].version.split(" on ")[0];
  });

  await check("tabel dibuat", async () => {
    await ensureSchema();
    const r = await allRows<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'`,
    );
    return `${r[0].n} tabel di schema public`;
  });

  await check("tulis & baca", async () => {
    // A read-only probe cannot detect a database where INSERT is denied, so do
    // a real round-trip through the same code path the app uses.
    const marker = `__probe_${Date.now().toString(36)}`;
    await runSql(
      `CREATE TABLE IF NOT EXISTS __connection_probe (id text primary key, at text)`,
    );
    await runSql(`INSERT INTO __connection_probe (id, at) VALUES (?, ?)`, [
      marker,
      new Date().toISOString(),
    ]);
    const back = await getRow<{ id: string }>(
      `SELECT id FROM __connection_probe WHERE id = ?`,
      [marker],
    );
    await runSql(`DROP TABLE __connection_probe`);
    return back?.id === marker
      ? "insert + select berhasil"
      : "data tidak kembali utuh";
  });

  let bad = 0;
  for (const r of results) {
    if (!r.ok) bad++;
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name} — ${r.detail}`);
  }
  console.log(`\n${results.length - bad}/${results.length} PASS\n`);

  await closePool();
  process.exit(bad ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

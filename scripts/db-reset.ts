// Reset script — truncate every table, recreate the schema, then reseed.
// Run: npm run db:reset
//
// Rewritten for PostgreSQL, and rewritten in .ts because it now imports the
// TypeScript data layer. The old version deleted a local file, which is the
// one thing that cannot be done here: a hosted database is not a file this
// process owns, and dropping the database would take the Neon/Supabase project
// off its free compute allocation.
//
// TRUNCATE ... CASCADE clears the tables in place and leaves the database
// itself alone. CASCADE is required because the foreign keys are genuinely
// enforced here; SQLite deferred them and never made the order matter.

import { execSync } from "node:child_process";
import { closePool, ensureSchema, runSql } from "../lib/db";

const TABLES = ["answers", "attempts", "questions", "quizzes", "children", "users"];

async function main() {
  console.log("🗑️  Resetting EaLearn database...");
  await ensureSchema();

  for (const t of TABLES) {
    const r = await runSql(`TRUNCATE TABLE ${t} CASCADE`);
    console.log(`   truncated ${t} (${r.changes})`);
  }

  await closePool();

  console.log("🌱 Re-running seed...");
  execSync("npx tsx scripts/db-seed.ts", { stdio: "inherit" });
  console.log("✅ DB reset complete");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

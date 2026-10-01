// Get quiz + share_uuid for testing
//
// Rewritten for PostgreSQL: the SQLite version called `db.prepare(...).get()`,
// which no longer exists now that the data layer is async. Wrapped in main()
// because tsx emits CommonJS and top-level await is not available there.
import { allRows } from "../lib/db";

type ReadyRow = { id: string; share_uuid: string };
type DraftRow = { id: string };

async function main() {
  const ready = await allRows<ReadyRow>(
    `SELECT id, share_uuid FROM quizzes WHERE status = 'ready' LIMIT 1`,
  );
  const draft = await allRows<DraftRow>(
    `SELECT id FROM quizzes WHERE status = 'draft' LIMIT 1`,
  );
  console.log(
    JSON.stringify({ ready: ready[0] ?? null, draft: draft[0] ?? null }),
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

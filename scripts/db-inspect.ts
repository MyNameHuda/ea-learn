// Inspect database — quick data dump
//
// Rewritten for PostgreSQL. Two changes beyond the obvious async one: the
// per-quiz counts use bound parameters instead of string-interpolating the id
// into the SQL, and the counts are fetched concurrently instead of one
// round-trip at a time.
import { allRows, getRow, ensureSchema, closePool } from "../lib/db";

interface CountRow {
  c: number;
}
interface QuizDbRow extends Record<string, unknown> {
  id: string;
  title: string;
  status: string;
}
interface AttemptDbRow extends Record<string, unknown> {
  child_name: string;
  total_score: number;
  max_score: number;
  status: string;
}
interface UserDbRow extends Record<string, unknown> {
  email: string;
  auth_provider: string;
  email_verified: number;
}

async function main() {
  await ensureSchema();
  console.log("=== DB STATE ===\n");

  const getCount = async (sql: string, params?: unknown[]): Promise<number> => {
    const row = await getRow<CountRow>(sql, params as never[]);
    return row?.c ?? 0;
  };

  const [userCount, quizCount, questionCount, attemptCount, childCount] =
    await Promise.all([
      getCount(`SELECT COUNT(*) as c FROM users`),
      getCount(`SELECT COUNT(*) as c FROM quizzes`),
      getCount(`SELECT COUNT(*) as c FROM questions`),
      getCount(`SELECT COUNT(*) as c FROM attempts`),
      getCount(`SELECT COUNT(*) as c FROM children`),
    ]);

  console.log(
    `Counts: ${userCount} users · ${childCount} children · ${quizCount} quizzes · ${questionCount} questions · ${attemptCount} attempts\n`,
  );

  const users = await allRows<UserDbRow>(`SELECT * FROM users`);
  console.log("Users:");
  users.forEach((u) => {
    console.log(`  - ${u.email} (${u.auth_provider}, verified=${u.email_verified})`);
  });

  const quizzes = await allRows<QuizDbRow>(
    `SELECT * FROM quizzes ORDER BY created_at DESC`,
  );
  console.log(`\nQuizzes (${quizzes.length}):`);
  for (const q of quizzes) {
    const [qCount, aCount] = await Promise.all([
      getCount(`SELECT COUNT(*) as c FROM questions WHERE quiz_id = ?`, [q.id]),
      getCount(`SELECT COUNT(*) as c FROM attempts WHERE quiz_id = ?`, [q.id]),
    ]);
    console.log(`  - "${q.title}" [${q.status}] - ${qCount}q / ${aCount}a`);
  }

  const attempts = await allRows<AttemptDbRow>(`SELECT * FROM attempts`);
  console.log(`\nAttempts (${attempts.length}):`);
  attempts.forEach((a) =>
    console.log(`  - ${a.child_name}: ${a.total_score}/${a.max_score} (${a.status})`),
  );
}

main()
  .then(() => closePool())
  .catch(async (e) => {
    console.error(e);
    await closePool();
    process.exit(1);
  });

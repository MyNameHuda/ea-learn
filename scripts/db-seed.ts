// Seed script — populate the PostgreSQL database with realistic dummy data
// Run: npm run db:seed
//
// Rewritten for PostgreSQL. Beyond the async change, the deletes are now
// ordered explicitly: SQLite ran them as one batch inside a deferred
// transaction and the order never mattered, whereas each statement here is
// its own round-trip and the foreign keys really are enforced.
//
// The one thing that has NOT changed is the intent — this is a local
// convenience for filling an empty database. Never point it at a database
// that has real rows in it.

import { runSql, allRows, ensureSchema, cuid, now, closePool } from "@/lib/db";
import bcrypt from "bcryptjs";

async function main() {
  console.log("🌱 Seeding EaLearn PostgreSQL database...");

  await ensureSchema();

  // Clean slate (idempotent reseed). Children first, then the rows that point
  // at them.
  const order = [
    "answers",
    "attempts",
    "questions",
    "quizzes",
    "children",
    "users",
  ];
  for (const t of order) {
    const r = await runSql(`DELETE FROM ${t}`);
    console.log(`   cleared ${t} (${r.changes})`);
  }

  const passwordHash = await bcrypt.hash("password123", 10);
  const rinaId = cuid();
  const nowIso = now();

  // === USERS ===
  await runSql(
    `INSERT INTO users (id, email, password_hash, display_name, email_verified, auth_provider, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, 'email', ?, ?)`,
    [rinaId, "rina@email.com", passwordHash, "Bunda Rina", nowIso, nowIso],
  );

  // === CHILDREN ===
  const aisyahId = cuid();
  await runSql(
    `INSERT INTO children (id, user_id, name, age_range, subjects, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [aisyahId, rinaId, "Aisyah", "9-12", JSON.stringify(["Matematika", "IPA"]), nowIso],
  );

  // === QUIZZES ===

  // Quiz 1: Matematika Pecahan (PG)
  const quiz1Id = cuid();
  const quiz1Share = cuid();
  await runSql(
    `INSERT INTO quizzes (id, user_id, share_uuid, title, description, subject, age_range, status, published_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'ready', ?, ?, ?)`,
    [
      quiz1Id, rinaId, quiz1Share, "Latihan Matematika Pecahan",
      "Bab 5: Pecahan untuk kelas 5 SD. Fokus soal cerita dan konversi.",
      "Matematika", "9-12",
      new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), nowIso, nowIso,
    ],
  );

  const quiz1Questions: Array<{ prompt: string; options: string[]; correct: number[] }> = [
    { prompt: "Berapakah hasil dari 1/2 + 1/4?", options: ["3/4", "1/3", "2/4", "2/6"], correct: [0] },
    { prompt: "Pecahan 5/8 sama nilainya dengan...", options: ["10/16", "20/16", "3/5", "2/3"], correct: [0] },
    { prompt: "Ubah 0,75 menjadi pecahan biasa...", options: ["1/2", "2/3", "3/4", "4/5"], correct: [2] },
  ];
  for (let i = 0; i < quiz1Questions.length; i++) {
    const q = quiz1Questions[i];
    await runSql(
      `INSERT INTO questions (id, quiz_id, order_index, type, prompt, options, correct_answer, points)
       VALUES (?, ?, ?, 'multiple_choice', ?, ?, ?, 10)`,
      [cuid(), quiz1Id, i + 1, q.prompt, JSON.stringify(q.options), JSON.stringify(q.correct)],
    );
  }

  // Quiz 2: IPA Tata Surya (mixed)
  const quiz2Id = cuid();
  const quiz2Share = cuid();
  await runSql(
    `INSERT INTO quizzes (id, user_id, share_uuid, title, description, subject, age_range, status, published_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'ready', ?, ?, ?)`,
    [
      quiz2Id, rinaId, quiz2Share, "IPA — Tata Surya",
      "Planet-planet di tata surya kita.",
      "IPA", "9-12",
      new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), nowIso, nowIso,
    ],
  );

  const quiz2Mc: Array<{ prompt: string; options: string[]; correct: number[] }> = [
    { prompt: "Planet apa yang paling dekat dengan matahari?", options: ["Venus", "Merkurius", "Bumi", "Mars"], correct: [1] },
    { prompt: "Planet terbesar di tata surya adalah...", options: ["Saturnus", "Jupiter", "Neptunus", "Uranus"], correct: [1] },
  ];
  for (let i = 0; i < quiz2Mc.length; i++) {
    const q = quiz2Mc[i];
    await runSql(
      `INSERT INTO questions (id, quiz_id, order_index, type, prompt, options, correct_answer, points)
       VALUES (?, ?, ?, 'multiple_choice', ?, ?, ?, 10)`,
      [cuid(), quiz2Id, i + 1, q.prompt, JSON.stringify(q.options), JSON.stringify(q.correct)],
    );
  }

  // Essay question
  await runSql(
    `INSERT INTO questions (id, quiz_id, order_index, type, prompt, keywords, keyword_weights, points)
     VALUES (?, ?, 3, 'essay', ?, ?, ?, 20)`,
    [
      cuid(), quiz2Id,
      "Jelaskan apa yang kamu ketahui tentang planet Jupiter. Sebutkan minimal 3 ciri khasnya.",
      JSON.stringify(["planet terbesar", "gas raksasa", "memiliki banyak satelit", "Bintik Merah Raksasa"]),
      JSON.stringify([3, 2, 2, 1]),
    ],
  );

  // Quiz 3: draft
  const quiz3Id = cuid();
  const quiz3Share = cuid();
  await runSql(
    `INSERT INTO quizzes (id, user_id, share_uuid, title, description, subject, age_range, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
    [
      quiz3Id, rinaId, quiz3Share, "Latihan UAS Matematika",
      "Persiapan UAS semester 1",
      "Matematika", "9-12", nowIso, nowIso,
    ],
  );
  await runSql(
    `INSERT INTO questions (id, quiz_id, order_index, type, prompt, options, correct_answer, points)
     VALUES (?, ?, 1, 'multiple_choice', 'Soal draft 1', ?, ?, 10)`,
    [cuid(), quiz3Id, JSON.stringify(["A", "B", "C", "D"]), JSON.stringify([0])],
  );

  // === ATTEMPTS (3 attempts on quiz1) ===
  const scores = [30, 20, 27];
  const names = ["Aisyah", "Raka", "Bima"];
  for (let i = 0; i < 3; i++) {
    const submittedAt = new Date(Date.now() - (i + 1) * 60 * 60 * 1000).toISOString();
    await runSql(
      `INSERT INTO attempts (id, quiz_id, child_name, total_score, max_score, status, submitted_at, graded_at, started_at)
       VALUES (?, ?, ?, ?, 30, 'graded', ?, ?, ?)`,
      [cuid(), quiz1Id, names[i], scores[i], submittedAt, submittedAt, submittedAt],
    );
  }

  const counts = await Promise.all(
    ["users", "children", "quizzes", "questions", "attempts"].map(async (t) => {
      const r = await allRows<{ c: number }>(`SELECT COUNT(*) as c FROM ${t}`);
      return `${t}=${r[0].c}`;
    }),
  );

  console.log(`✅ Seeded: ${counts.join(" · ")}`);
  console.log(`   - 1 user: rina@email.com / password123`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    // A pooled connection keeps the Node process alive, so the script has to
    // close it explicitly. SQLite had nothing to close.
    closePool();
  });
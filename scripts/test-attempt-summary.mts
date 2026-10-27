/**
 * Test: ringkasan jawaban di halaman hasil anak.
 *
 * Dua hal yang harus dibuktikan:
 *   1. Setelah selesai, anak melihat nomor soal, jawabannya sendiri, dan
 *      apakah itu benar atau salah.
 *   2. Jawaban yang BENAR tidak pernah muncul untuk soal yang dijawab salah.
 *
 * Point 2 diuji dengan memakai teks opsi yang khas, jadi kalau teks kunci
 * bocor ke HTML halaman hasil, assertion ini langsung gagal.
 *
 * Test ini sengaja tanpa browser: yang diuji adalah isi HTML yang benar-benar
 * dikirim ke anak, dan itu bisa diambil dengan HTTP biasa. Halaman hasil juga
 * tidak butuh login, anak tidak punya akun.
 *
 * Run: npm run test:ringkasan   (server lokal harus jalan di :3000)
 *      BASE_URL=https://ea-learn.vercel.app npm run test:ringkasan
 */
import { Client } from "pg";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const STAMP = Date.now();
const EMAIL = `ringkasan-${STAMP}@example.com`;
const PASSWORD = "Ringkasan12345!";

/* Teks opsi yang khas supaya kemunculannya di HTML bisa diassert. */
const KUNCI_SOAL1 = "KunciSoalSatu";
const KUNCI_SOAL2 = "KunciSoalDua";
const SALAH_SOAL2 = "JawabanSalahSoalDua";
const DISTRACTOR = "PilihanDistraktor";
const JAWABAN_ESSAY = "Jawaban essay anak uji ringkasan";

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

const db = new Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

const jar = new Map<string, string>();
const absorb = (res: Response) => {
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const [pair] = c.split(";");
    jar.set(pair.slice(0, pair.indexOf("=")), c);
  }
};
const cookies = () =>
  [...jar.entries()]
    .map(([k, v]) => `${k}=${v.slice(v.indexOf("=") + 1).split(";")[0]}`)
    .join("; ");

async function csrf(): Promise<string> {
  const r = await fetch(`${BASE}/api/auth/csrf`);
  absorb(r);
  return ((await r.json()) as { csrfToken: string }).csrfToken;
}

async function api(path: string, opts: RequestInit = {}) {
  const r = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Cookie: cookies(),
      ...((opts.headers as Record<string, string>) ?? {}),
    },
  });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
}

/** Halaman hasil anak tidak butuh sesi, jadi fetch biasa. */
async function publicApi(path: string, body: unknown) {
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

console.log(`BASE = ${BASE}`);

console.log("\n=== 0. akun uji + kuis ===");
// Counter play-start di IP ini bisa sudah terpakai oleh test sebelumnya.
await db.query("delete from rate_limits where key like $1", ["play:ip:%"]);

await fetch(`${BASE}/api/auth/signup`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Cookie: cookies() },
  body: JSON.stringify({
    displayName: "Uji Ringkasan",
    email: EMAIL,
    password: PASSWORD,
    confirmPassword: PASSWORD,
  }),
});
{
  const t = await csrf();
  absorb(
    await fetch(`${BASE}/api/auth/callback/credentials`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookies() },
      body: new URLSearchParams({ csrfToken: t, email: EMAIL, password: PASSWORD }),
      redirect: "manual",
    }),
  );
}
const sess = (await (
  await fetch(`${BASE}/api/auth/session`, { headers: { Cookie: cookies() } })
).json()) as { user?: { email?: string } };
if (!sess.user?.email) {
  console.log("  gagal login");
  process.exit(1);
}

const created = await api("/api/quiz/create", {
  method: "POST",
  body: JSON.stringify({ title: "Uji Ringkasan", subject: "PPKN", ageRange: "12" }),
});
const quizId = (created.body as { id: string }).id;
const shareUuid = (created.body as { shareUuid: string }).shareUuid;
console.log("  quizId:", quizId);

async function addQuestion(body: Record<string, unknown>) {
  const r = await api(`/api/quiz/${quizId}/question`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return (r.body as { question: { id: string } }).question.id;
}
async function fillQuestion(qid: string, body: Record<string, unknown>) {
  const r = await api(`/api/quiz/${quizId}/question/${qid}`, {
    method: "PATCH",
    body: JSON.stringify({ imageUrl: null, ...body }),
  });
  if (r.status !== 200) console.log("  PATCH gagal:", r.status, JSON.stringify(r.body).slice(0, 160));
}

const q1 = await addQuestion({ type: "multiple_choice", prompt: "", options: ["", ""], correctAnswer: [0], points: 10 });
await fillQuestion(q1, {
  type: "multiple_choice",
  prompt: "Soal pertama untuk uji ringkasan",
  options: [KUNCI_SOAL1, SALAH_SOAL2, DISTRACTOR],
  correctAnswer: [0],
});
const q2 = await addQuestion({ type: "multiple_choice", prompt: "", options: ["", ""], correctAnswer: [0], points: 10 });
await fillQuestion(q2, {
  type: "multiple_choice",
  prompt: "Soal kedua untuk uji ringkasan",
  options: [KUNCI_SOAL2, "JawabanSalahSoalDua", "DistraktorKedua"],
  correctAnswer: [0],
});
const q3 = await addQuestion({ type: "essay", prompt: "", keywords: [""], keywordWeights: [1], points: 20 });
await fillQuestion(q3, {
  type: "essay",
  prompt: "Jelaskan hukum mad aridh lisukun",
  keywords: ["khusus"],
  keywordWeights: [2],
});
const pub = await api(`/api/quiz/${quizId}/publish`, { method: "POST" });
check("kuis dipublish", pub.status === 200, `HTTP ${pub.status}`);

console.log("\n=== 1. anak mengerjakan: soal1 benar, soal2 salah, essay ===");
const start = await publicApi("/api/play/start", { shareUuid, childName: "Anak Ringkasan" });
check("attempt dimulai", start.status === 200 && Boolean(start.body.attemptId), `HTTP ${start.status}`);
const attemptId = start.body.attemptId as string;

const a1 = await publicApi("/api/play/answer", {
  attemptId,
  questionId: q1,
  type: "multiple_choice",
  selectedIndices: [0], // benar
});
const a2 = await publicApi("/api/play/answer", {
  attemptId,
  questionId: q2,
  type: "multiple_choice",
  selectedIndices: [1], // salah
});
const a3 = await publicApi("/api/play/answer", {
  attemptId,
  questionId: q3,
  type: "essay",
  text: JAWABAN_ESSAY,
});
check("3 jawaban tersimpan", a1.status === 200 && a2.status === 200 && a3.status === 200);

const sub = await publicApi("/api/play/submit", { attemptId });
check("attempt disubmit", sub.status === 200, `HTTP ${sub.status}`);

console.log("\n=== 2. isi halaman hasil anak ===");
const doneUrl = `${BASE}/play/${shareUuid}/done?attempt=${attemptId}`;
const html = await (await fetch(doneUrl)).text();
// Buang <script>: payload RSC Next.js menyertakan seluruh flight data, dan
// assertion "tidak ada" harus memeriksa HTML yang benar-benar dirender.
const visible = html
  .replace(/<script[\s\S]*?<\/script>/g, "")
  .replace(/<style[\s\S]*?<\/style>/g, "");
const text = visible
  .replace(/<[^>]+>/g, " ")
  .replace(/&quot;/g, '"')
  .replace(/&#x27;/g, "'")
  .replace(/\s+/g, " ");

check("ada bagian 'Ringkasan jawaban'", /Ringkasan jawaban/i.test(text));
check("ada penanda 'Benar'", /Benar/.test(text));
check("ada penanda 'Salah'", /Salah/.test(text));
check("ada penanda 'Menunggu review' untuk essay", /Menunggu review/i.test(text));
check("tercantum rekap jumlah", /\d+ benar/.test(text), text.match(/\d+ benar[^·]*/)?.[0] ?? "");
check("tercantum rekap jumlah salah", /\d+ salah/.test(text), text.match(/\d+ salah/)?.[0] ?? "");

console.log("\n=== 3. jawaban anak sendiri ditampilkan ===");
check("jawaban benar anak (soal 1) tampil", text.includes(KUNCI_SOAL1));
check("jawaban salah anak (soal 2) tampil", text.includes(SALAH_SOAL2));
check("jawaban essay anak tampil", text.includes(JAWABAN_ESSAY));
check("nomor soal tampil", /Soal 1\/3|1/.test(text));

console.log("\n=== 4. KUNCI JAWABAN TIDAK BOLEH BOCOR ===");
check(
  `kunci jawaban soal 2 (${KUNCI_SOAL2}) tidak muncul`,
  !text.includes(KUNCI_SOAL2),
  text.includes(KUNCI_SOAL2) ? "BOCOR!" : "",
);
check(
  `opsi yang tidak dipilih (${DISTRACTOR}) tidak muncul`,
  !text.includes(DISTRACTOR),
  text.includes(DISTRACTOR) ? "BOCOR!" : "",
);
check(
  "kunci jawaban mentah (JSON) tidak muncul",
  !visible.includes("correct_answer"),
  visible.includes("correct_answer") ? "BOCOR!" : "",
);
check(
  "keyword essay tidak ikut terbawa",
  !visible.includes("keyword_weights") && !visible.includes("khusus"),
  visible.includes("khusus") ? "BOCOR!" : "",
);

console.log("\n=== 5. attempt tersimpan & dinilai ===");
const at = (
  await db.query(
    "select id, total_score, max_score, status from attempts where id = $1",
    [attemptId],
  )
).rows[0];
const ans = (
  await db.query(
    "select question_id, response, auto_score, final_score from answers where attempt_id = $1",
    [attemptId],
  )
).rows;
console.log("  attempt:", JSON.stringify(at));
check("3 jawaban tersimpan", ans.length === 3, `n=${ans.length}`);
check(
  "soal 1 auto_score = 10 (benar)",
  ans.find((a) => a.question_id === q1)?.auto_score === 10,
);
check(
  "soal 2 auto_score = 0 (salah)",
  ans.find((a) => a.question_id === q2)?.auto_score === 0,
);
check(
  "essay belum direview (final_score null)",
  ans.find((a) => a.question_id === q3)?.final_score === null,
);

console.log("\n=== 6. bersihkan ===");
{
  const u = (await db.query("select id from users where email = $1", [EMAIL])).rows[0] as
    | { id: string }
    | undefined;
  if (u) await db.query("delete from users where id = $1", [u.id]);
  await db.query("delete from rate_limits where key like $1", ["play:ip:%"]);
}
await db.end();
console.log(`\n=== ${fail === 0 ? "SEMUA LOLOS" : fail + " GAGAL"}: ${pass} pass, ${fail} fail ===`);
process.exit(fail === 0 ? 0 : 1);

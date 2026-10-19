/**
 * Regression test: menyimpan isi soal harus berhasil untuk soal TANPA gambar.
 *
 * Run: npm run test:soal          (server lokal harus jalan di :3000)
 *      BASE_URL=https://ea-learn.vercel.app npm run test:soal
 *
 * ── Blind spot yang ditutup test ini ────────────────────────────────────────
 * Test sebelumnya (test-editor-image.mjs) selalu mengunggah gambar dulu, lalu
 * memverifikasi image_url masuk database. Itu membuat imageUrl berupa string
 * URL — dan string URL-nya lolos validasi. Tidak ada satu pun test yang
 * mencoba menyimpan soal tanpa gambar.
 *
 * Padahal editor SELALU mengirim `imageUrl: updated.imageUrl ?? null`, jadi
 * null muncul di setiap soal tanpa gambar, dan null tidak pernah lolos
 * skema. Hasilnya: 400 "Invalid input" pada setiap penyimpanan, teks soal
 * tidak pernah masuk database, dan tidak ada error yang terlihat di layar.
 *
 * Test ini sengaja tidak memakai browser: yang diuji adalah kontrak antara
 * klien dan server, dan itu bisa diperiksa lewat HTTP biasa.
 */
import { Client } from "pg";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const STAMP = Date.now();
const EMAIL = `soal-save-${STAMP}@example.com`;
const PASSWORD = "SoalSave12345!";

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

console.log(`BASE = ${BASE}`);

console.log("\n=== 0. akun uji ===");
await fetch(`${BASE}/api/auth/signup`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Cookie: cookies() },
  body: JSON.stringify({
    displayName: "Uji Simpan Soal",
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
console.log("  sesi:", sess.user.email);

const created = await api("/api/quiz/create", {
  method: "POST",
  body: JSON.stringify({ title: "Uji Simpan Soal", subject: "PPKN", ageRange: "12" }),
});
const quizId = (created.body as { id: string }).id;
console.log("  quizId:", quizId);

async function newQuestion(): Promise<string> {
  const r = await api(`/api/quiz/${quizId}/question`, {
    method: "POST",
    body: JSON.stringify({
      type: "multiple_choice",
      prompt: "",
      options: ["", ""],
      correctAnswer: [0],
      points: 10,
    }),
  });
  return (r.body as { question: { id: string } }).question.id;
}

const rowOf = async (qid: string) =>
  (
    await db.query("select prompt, options, image_url from questions where id = $1", [qid])
  ).rows[0] as { prompt: string; options: string; image_url: string | null };

const bodyWith = (over: Record<string, unknown> = {}) => ({
  type: "multiple_choice",
  prompt: "Isi soal uji",
  options: ["Benar", "Salah"],
  correctAnswer: [0],
  points: 10,
  ...over,
});

console.log("\n=== 1. PATCH dengan imageUrl ABSENT ===");
{
  const qid = await newQuestion();
  const body = bodyWith();
  delete (body as Record<string, unknown>).imageUrl;
  const r = await api(`/api/quiz/${quizId}/question/${qid}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  check("status 200", r.status === 200, `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 140)}`);
  const row = await rowOf(qid);
  check("isi soal tersimpan di DB", row.prompt === "Isi soal uji", `prompt=${JSON.stringify(row.prompt)}`);
}

console.log("\n=== 2. PATCH dengan imageUrl: null (editor sekarang) ===");
{
  const qid = await newQuestion();
  const r = await api(`/api/quiz/${quizId}/question/${qid}`, {
    method: "PATCH",
    body: JSON.stringify(bodyWith({ imageUrl: null })),
  });
  check("status 200", r.status === 200, `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 140)}`);
  const row = await rowOf(qid);
  check("isi soal tersimpan di DB", row.prompt === "Isi soal uji", `prompt=${JSON.stringify(row.prompt)}`);
  check("image_url tetap NULL", row.image_url === null, `image_url=${row.image_url}`);
}

console.log("\n=== 3. PATCH dengan imageUrl: '' (string kosong) ===");
{
  const qid = await newQuestion();
  const r = await api(`/api/quiz/${quizId}/question/${qid}`, {
    method: "PATCH",
    body: JSON.stringify(bodyWith({ imageUrl: "" })),
  });
  check("status 200", r.status === 200, `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 140)}`);
  const row = await rowOf(qid);
  check("isi soal tersimpan di DB", row.prompt === "Isi soal uji", `prompt=${JSON.stringify(row.prompt)}`);
}

console.log("\n=== 4. KEAMANAN: imageUrl berbahaya tetap ditolak ===");
for (const bad of [
  "javascript:alert(1)",
  "https://evil.example.com/x.png",
  "/uploads/questions/../../etc/passwd",
]) {
  const qid = await newQuestion();
  const r = await api(`/api/quiz/${quizId}/question/${qid}`, {
    method: "PATCH",
    body: JSON.stringify(bodyWith({ imageUrl: bad })),
  });
  check(`ditolak: ${bad}`, r.status === 400, `HTTP ${r.status}`);
}

console.log("\n=== 5. imageUrl Cloudinary yang valid tetap diterima ===");
{
  const qid = await newQuestion();
  const url = "https://res.cloudinary.com/demo/image/upload/v123/soal.png";
  const r = await api(`/api/quiz/${quizId}/question/${qid}`, {
    method: "PATCH",
    body: JSON.stringify(bodyWith({ imageUrl: url })),
  });
  check("status 200", r.status === 200, `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 140)}`);
  const row = await rowOf(qid);
  check("gambar tersimpan", row.image_url === url, `image_url=${row.image_url}`);
}

console.log("\n=== 6. bersihkan ===");
{
  const u = (
    await db.query("select id from users where email = $1", [EMAIL])
  ).rows[0] as { id: string } | undefined;
  if (u) await db.query("delete from users where id = $1", [u.id]);
  await db.query("delete from rate_limits");
}
await db.end();

console.log(`\n=== ${fail === 0 ? "SEMUA LOLOS" : fail + " GAGAL"} — ${pass} pass, ${fail} fail ===`);
process.exit(fail === 0 ? 0 : 1);

/**
 * Regression test: halaman Bagikan tidak boleh memberi link yang 404.
 *
 * Run: npm run test:share        (server lokal harus jalan di :3000)
 *      BASE_URL=https://ea-learn.vercel.app npm run test:share
 *
 * ── Bug yang ditutup test ini ───────────────────────────────────────────────
 * Halaman /quiz/<id>/share selalu menampilkan "Kuis siap dishare!" plus link
 * ke /play/<uuid>, apa pun status kuis. Padahal /play/<uuid> menjawab 404
 * untuk kuis yang belum dipublish. Jadi orang tua mengambil link dari sana,
 * mengirimnya ke anak, dan anak mendapat "halaman tidak ditemukan" tanpa
 * penjelasan di mana masalahnya.
 *
 * Test ini mengunci dua hal:
 *   - kuis draft  -> halaman Bagikan TIDAK boleh memuat link /play/<uuid>
 *   - kuis ready  -> halaman Bagikan HARUS memuat link itu
 */
import { Client } from "pg";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const STAMP = Date.now();
const EMAIL = `share-draft-${STAMP}@example.com`;
const PASSWORD = "ShareDraft12345!";

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
    displayName: "Uji Share Draft",
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
  body: JSON.stringify({ title: "Uji Share Draft", subject: "PPKN", ageRange: "12" }),
});
const quizId = (created.body as { id: string }).id;
const shareUuid = (created.body as { shareUuid: string }).shareUuid;
console.log("  quizId:", quizId);

const sharePage = async () => {
  const r = await fetch(`${BASE}/quiz/${quizId}/share`, { headers: { Cookie: cookies() } });
  return { status: r.status, html: await r.text() };
};

console.log("\n=== 1. kuis DRAFT: halaman Bagikan tidak boleh punya link ===");
{
  const p = await sharePage();
  check("halaman 200", p.status === 200, `HTTP ${p.status}`);
  check("tidak ada link /play/<uuid>", !p.html.includes(`/play/${shareUuid}`), "link ditemukan (bug!)");
  check("ada penjelasan belum dipublish", /belum dipublish/i.test(p.html));
  check("ada tombol publish", /publish/i.test(p.html));
  check("tidak ada kalimat 'Kuis siap dishare'", !/Kuis siap dishare/i.test(p.html));
}

console.log("\n=== 2. isi soal lalu publish ===");
{
  const q = await api(`/api/quiz/${quizId}/question`, {
    method: "POST",
    body: JSON.stringify({
      type: "multiple_choice",
      prompt: "",
      options: ["", ""],
      correctAnswer: [0],
      points: 10,
    }),
  });
  const qid = (q.body as { question: { id: string } }).question.id;
  const patch = await api(`/api/quiz/${quizId}/question/${qid}`, {
    method: "PATCH",
    body: JSON.stringify({
      type: "multiple_choice",
      prompt: "Soal untuk uji share",
      options: ["Benar", "Salah"],
      correctAnswer: [0],
      points: 10,
      imageUrl: null,
    }),
  });
  check("soal tersimpan", patch.status === 200, `HTTP ${patch.status}`);

  const pub = await api(`/api/quiz/${quizId}/publish`, { method: "POST" });
  check("publish berhasil", pub.status === 200, `HTTP ${pub.status} ${JSON.stringify(pub.body).slice(0, 120)}`);
}

console.log("\n=== 3. kuis READY: halaman Bagikan harus punya link ===");
{
  const p = await sharePage();
  check("halaman 200", p.status === 200, `HTTP ${p.status}`);
  check("ada link /play/<uuid>", p.html.includes(`/play/${shareUuid}`));
  check("ada kalimat 'Kuis siap dishare'", /Kuis siap dishare/i.test(p.html));
}

console.log("\n=== 4. play linknya benar-benar bisa dibuka ===");
{
  const r = await fetch(`${BASE}/play/${shareUuid}`, { redirect: "manual" });
  const html = await r.text();
  // Buang <script> dulu: payload RSC Next.js selalu menyertakan boundary
  // notFound() di setiap halaman, jadi string "404" dan "Halaman tidak
  // ditemukan" muncul di HTML halaman BERHASIL pun. Yang diperiksa harus
  // teks yang benar-benar terlihat.
  const visible = html
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<style[\s\S]*?<\/style>/g, "");
  check("play page tidak menampilkan halaman 404", !visible.includes("Halaman tidak ditemukan"));
  check("judul kuis tampil di play page", visible.includes("Uji Share Draft"));
  check("tombol Mulai Sekarang tampil", visible.includes("Mulai Sekarang"));
}

console.log("\n=== 5. bersihkan ===");
{
  const u = (await db.query("select id from users where email = $1", [EMAIL])).rows[0] as
    | { id: string }
    | undefined;
  if (u) await db.query("delete from users where id = $1", [u.id]);
  await db.query("delete from rate_limits");
}
await db.end();

console.log(`\n=== ${fail === 0 ? "SEMUA LOLOS" : fail + " GAGAL"} — ${pass} pass, ${fail} fail ===`);
process.exit(fail === 0 ? 0 : 1);

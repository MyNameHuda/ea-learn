# EaLearn

> Mobile-first quiz platform untuk orang tua Indonesia membuat soal latihan untuk anaknya.
> **Hybrid grading**: auto-grade pilihan ganda + manual review essay dengan keyword suggestion.
>
> **Stack**: Next.js 16 (App Router) · React 19 · TypeScript · **PostgreSQL** (Neon / Supabase, via `pg`) · NextAuth v5 · Tailwind 4 · Vercel

**Status**: Praproduksi. Deploy ke Vercel dengan database terkelola.

---

## 🚀 Quick Start

Butuh **PostgreSQL** — tidak ada lagi SQLite lokal. Gratis semua cukup:
[Neon](https://neon.tech) atau [Supabase](https://supabase.com).

```bash
npm install
cp .env.example .env
# Isi DATABASE_URL (WAJIB pakai endpoint pooled/pooler) + AUTH_SECRET

npm run db:test      # pastikan koneksi jalan sebelum lanjut
npm run db:seed      # demo data: rina@email.com / password123
npm run dev
```

`npm run build` dan `npm start` juga butuh `DATABASE_URL` terisi di environment.

---

## 🚀 Deploy ke Vercel

```bash
npm i -g vercel
vercel link
vercel env add DATABASE_URL production
vercel env add AUTH_SECRET production
vercel env add NEXTAUTH_URL production     # https://domain-anda.com
vercel env add BLOB_READ_WRITE_TOKEN production   # Storage → Blob
npm run deploy
```

**Tiga hal yang akan menggigit kalau dilewatkan:**

1. **Pakai endpoint POOLED.** Non-pooled akan kehabisan koneksi begitu
   beberapa fungsi hidup bersamaan. `lib/db.ts` memakai `max: 1` per instance
   karena itu.
2. **BLOB_READ_WRITE_TOKEN wajib di produksi.** Tanpa itu, gambar soal ditulis
   ke `public/uploads/` — yang bekerja di `npm run dev` tapi hilang di Vercel,
   karena filesystem fungsi dibuang tiap invokasi.
3. **Ganti AUTH_SECRET.** Nilai di repo berarti siapa pun yang membacanya bisa
   memalsukan sesi login.

---

## 🗄 Database

**PostgreSQL** lewat `pg` (`lib/db.ts`). Tanpa ORM.

**Penting untuk serverless:**
- Pool dibuat **saat query pertama**, bukan saat import — `next build`
  mengimpor semua route, dan pool yang dibuat saat import akan membuat build
  butuh koneksi database (di Vercel, itu berarti build menyentuh produksi).
- `max: 1` per instance. Postgres menghitung koneksi per database, bukan per
  instance; pool default (10) dikali dua belas fungsi yang sedang hidup akan
  langsung kehabisan koneksi.
- Type parser untuk `int8` (OID 20) dipasang manual, karena `pg` mengirimnya
  sebagai string dan `SUM()`/hitungan besar akan rusak diam-diam.
- Timestamp tetap kolom `TEXT`, bukan `TIMESTAMPTZ` — aplikasinya menulis
  string ISO dan membacanya sebagai string. Mengubahnya akan memberi objek
  `Date` di tempat yang mengharapkan string.

**Schema** (7 tabel): `users`, `user_settings`, `children`, `quizzes`,
`questions`, `attempts`, `answers`.

Tidak ada tabel token apa pun. `verification_codes` dan `password_reset_tokens`
pernah ada lalu dibuang, karena tidak ada alur yang memakainya lagi.

**Scripts**:
```bash
npm run db:test      # uji koneksi (koneksi, tabel, tulis & baca)
npm run db:seed      # isi demo data
npm run db:reset     # truncate semua + seed ulang (⚠️ destruktif)
npm run db:inspect   # ringkasan isi database
```

---

## 📁 Project Structure

```
ealearn/
── app/                     # Next.js App Router
│   ── layout.tsx           # Root layout + Providers
│   ── page.tsx             # Landing page
│   ── globals.css          # Design system
│   ── error.tsx            # Error boundary
│   ── loading.tsx          # Loading skeleton
│   ── not-found.tsx        # 404 page
│   ── login/               # Auth: centered email + password
│   ── signup/              # Auth: pendaftaran (nama, email, password, konfirmasi)
│   ── hasil/               # Riwayat hasil semua kuis
│   ── dashboard/           # Bento-grid dashboard
│   ── profile/             # User profile + settings
│   │   ── akun/            # Email akun, ubah password, kontak lupa password
│   ── onboarding/          # 3-step onboarding wizard
│   ── quiz/new/            # Quiz creation form
│   ── quiz/[id]/           # Quiz detail + actions
│   ── quiz/[id]/edit/      # ⭐ Full editor (PG + essay + auto-save)
│   ── quiz/[id]/share/     # Share link + QR
│   ── quiz/[id]/results/   # Results list (timeline)
│   ── quiz/[id]/results/[attempt]/  # ⭐ Per-question breakdown + essay review
│   ── play/[uuid]/         # Child landing
│   ── play/[uuid]/name/    # Child name input
│   ── play/[uuid]/do/      # ⭐ Per-question player (anonymous)
│   ── play/[uuid]/done/    # Child done screen
│   ── api/                 # 13 API routes
── components/              # 9 React components
│   ── Providers.tsx        # SessionProvider + ToastProvider
│   ── MobileFrame.tsx      # Responsive shell wrapper
│   ── BottomNav.tsx        # Mobile bottom navigation
│   ── Toast.tsx            # Global toast notifications
│   ── Icon.tsx             # 20+ SVG icons (no deps)
│   ── LogoutButton.tsx
│   ── QuizEditor.tsx       # ⭐ Editor client component
│   ── AttemptDetail.tsx    # ⭐ Review UI client component
│   ── OnboardingFlow.tsx   # ⭐ Onboarding wizard client component
── lib/                     # Backend logic
│   ── db.ts                # PostgreSQL pool + schema
│   ── queries.ts           # TypeScript types + mappers
│   ── queries/data.ts      # CRUD operations
│   ── grading.ts           # ⭐ Auto-grade engine (PG exact + essay keyword)
│   ── auth.ts              # NextAuth v5 config
│   ── utils.ts             # timeAgoID helper
── scripts/                 # Database utilities
│   ── db-seed.ts           # Seed dummy data
│   ── db-reset.mjs         # Clear + reseed
│   ── db-inspect.ts        # Data dump
│   ── get-test-ids.ts      # Get quiz/share uuids (for testing)
── public/                  # Static assets
│   ── manifest.json        # PWA manifest
│   ── sw.js                # Service worker
│   ── icon.svg             # App icon
── public/                 # logo, ikon, manifest, service worker
── .env                     # Environment variables (gitignored)
── README.md
```

---

## 🗄 Database

*(Lihat bagian Deploy di atas — ringkas: PostgreSQL via `pg`, tanpa ORM, pool
`max: 1` per instance serverless, dan skrip `db:*` untuk seed/reset/inspect/
migrate.)*

---

## 🔐 Auth Flow

- **NextAuth v5** (beta.32) dengan Credentials provider
- **JWT session** strategy (no DB session table)
- Email lowercased + trimmed at signup & lookup
- **Tidak ada verifikasi email** dan **tidak ada reset password otomatis** —
  keduanya butuh mailer yang tidak dijalankan. Lupa password ditangani manual
  lewat email/WhatsApp ke developer (`components/ContactSupport.tsx`).
- `lib/auth.ts` butuh `AUTH_SECRET` dari `.env` di produksi

---

## 🎨 Design System

CSS variables di `app/globals.css`:
- Morandi sage palette: primary `#6b7c5c`, accent `#d4a574`, bg `#faf7f2`
- Responsive: shell 480px mobile → 1200px desktop
- 20+ SVG icons (no external deps)
- Toast notifications
- Bottom navigation (mobile)
- Modal sheets, alert banners, tags, cards, form controls

**Per-page background variations**:
- **Landing**: warm cream radial gradients
- **Login/Signup**: gradient panels (hijau / terracotta)
- **Dashboard**: soft beige
- **Quiz share**: deep green gradient
- **Play (child)**: vibrant green

---

## 🛣 Routes (40 total)

```
Public (4):                    Protected (15):
/                              /dashboard
/login                         /hasil
/signup                        /onboarding
/_not-found (404)              /profile
                               /profile/akun
API (14):                      /profile/bantuan
/api/auth/[...nextauth]         /profile/notifikasi
/api/auth/signup                /profile/privasi
/api/account/password           /profile/tentang
/api/upload                     /quiz/new
/api/settings                   /quiz/[id]
/api/onboarding/save            /quiz/[id]/edit
/api/quiz/create                /quiz/[id]/share
/api/quiz/[id]/update           /quiz/[id]/results
/api/quiz/[id]/publish          /quiz/[id]/results/[attempt]
/api/quiz/[id]/delete
/api/quiz/[id]/question
/api/quiz/[id]/question/[qid]
/api/attempt/[id]/review
/api/play/start
/api/play/fetch
/api/play/answer
/api/play/submit

Child (4, anonymous):          PWA:
/play/[uuid]                   /manifest.json
/play/[uuid]/name               /sw.js
/play/[uuid]/do                 /icon.svg
/play/[uuid]/done
```

**Auth: email + password, tanpa verifikasi email.** Pendaftaran di `/signup`
langsung membuat akun yang bisa dipakai — tidak ada kode yang dikirim, tidak
ada layar kedua yang bisa menggantung. `/login` menerima email + password
(bcrypt, `Credentials` provider).

**Tidak ada reset password otomatis.** Dulu ada tautan reset yang mengirim
email; itu dihapus karena butuh mailer yang tidak lagi dijalankan, dan tombol
"kirim kode" yang diam-diam tidak pernah mengirim apa pun lebih buruk daripada
menyatakan terus terang. Lupa password ditangani manual: pengguna menghubungi
developer lewat email atau WhatsApp. Satu-satunya kanal yang ditampilkan, di
halaman Masuk dan di `/profile/akun`.

Karena tidak ada email keluar sama sekali, `nodemailer` sudah dilepas dari
dependensi. Tidak ada kredensial SMTP atau OAuth yang perlu diisi.

**Gambar soal.** Setiap soal boleh punya satu gambar opsional — untuk geometri,
peta, atau soal yang perlu dibaca dari gambar. Fieldnya ada di editor untuk soal
pilihan ganda maupun essay, dan gambarnya ikut tampil di layar anak serta di
halaman review orang tua.

Upload lewat `POST /api/upload` (butuh login), dan berkas diperlakukan sebagai
input musuh:

- Tipe ditentukan dari **magic bytes**, bukan dari `Content-Type` atau nama file
  yang dikirim browser — keduanya bisa dipalsukan.
- Nama file **dibuat server**, bukan diambil dari nama unggahan. Kalau memakai
  nama itu, `../../etc/passwd` akan lolos.
- **SVG ditolak.** SVG adalah dokumen XML yang bisa membawa `<script>`, dan
  gambarnya disajikan dari origin yang sama dengan aplikasinya — jadi SVG
  unggahan adalah stored XSS. Menolaknya lebih murah daripada membersihkannya.
- Batas 5 MB, diperiksa sebelum body dibaca ke memori dan lagi setelahnya,
  karena `Content-Length` itu klaim, bukan fakta.

Berkas disimpan di `public/uploads/questions/` (gitignored). Kalau nanti
dipindah ke hosting serverless, folder itu tidak awet — endpoint upload perlu
object store sungguhan._asumsi itu hanya ada di satu file: `app/api/upload/route.ts`.

---

## 🧪 PRD Feature Coverage

| PRD Feature | Status | Implementation |
|---|---|---|
| Parent login | ✅ | `/login` (split panel) + `signIn("credentials")` dari NextAuth |
| Email + password auth | ✅ | bcryptjs cost 10, JWT session, `Credentials` provider |
| Signup | ✅ | `/signup` + `/api/auth/signup`, dengan konfirmasi password |
| Email verification | ❌ | Sengaja dihapus — lihat catatan Auth di bagian Routes |
| Lupa password | ⚠️ Manual | Belum ada reset otomatis; kontak developer via email/WhatsApp |
| Onboarding 3-step | ✅ | `/onboarding` wizard + `/api/onboarding/save` |
| Dashboard | ✅ | Bento grid + BottomNav + FAB |
| Profile | ✅ | `/profile` with anak list, settings menu |
| Quiz creation | ✅ | Form + 50-soal limit + auto-save + publish |
| Quiz editor PG | ✅ | Radio marking (satu jawaban benar) + add/remove opsi + gambar opsional |
| Quiz editor essay | ✅ | Keyword + weight input + gambar opsional |
| Share link | ✅ | 4-channel: WhatsApp / Telegram / Email / SMS |
| Gambar soal | ✅ | Upload PNG/JPG/GIF/WebP (≤5MB) → Vercel Blob, tampil di layar anak & review |
| Child play (anonymous) | ✅ | Name input → per-question → submit |
| Auto-grade PG | ✅ | Exact-match scoring |
| Hybrid grading essay | ✅ | Keyword weight + parent override |
| Essay review UI | ✅ | Slider override + komentar + auto-recompute |
| Result detail per-soal | ✅ | Correct/wrong indicators + colors |
| Reset password | ❌ | Sengaja dihapus — kontak developer manual |
| Email verification | ❌ | Sengaja dihapus — lihat catatan Auth di bagian Routes |
| PWA install | ✅ | manifest.json + service worker + apple-mobile meta |
| Responsive (PC + Mobile) | ✅ | Auto-fit grids, centered auth, breakpoints |

---

## 🚀 Production Deployment

Lihat bagian **Deploy ke Vercel** di atas untuk langkah lengkap.

Ringkasnya: `npm run build` → pasang empat environment variable
(`DATABASE_URL`, `AUTH_SECRET`, `NEXTAUTH_URL`, `BLOB_READ_WRITE_TOKEN`) →
`vercel --prod`. `vercel.json` sudah menetapkan `regions: ["sin1"]` (Jakarta
paling dekat denganNeon Singapore / Supabase Asia) — tanpa itu, fungsi Vercel
default_compute di AS dan setiap query database-imposed ~250msBolak-balik.

### Pre-requisites
- Node.js 22+
- Database PostgreSQL di Neon atau Supabase (free tier cukup)
- Akun Vercel

### Steps

1. **Siapkan database**:
   ```bash
   # Neon → Connection string → PAKAI YANG POOLED
   # Supabase → Project Settings → Database → URI
   npm run db:test     # pastikan koneksi jalan
   npm run db:seed    # opsional: demo data
   ```

2. **Environment variables** di Vercel:
   ```env
   DATABASE_URL="postgresql://...pooled..."
   AUTH_SECRET="<32+ hex chars acak>"
   NEXTAUTH_URL="https://yourdomain.com"
   BLOB_READ_WRITE_TOKEN="vercel_blob_rw_..."
   ```

3. **Deploy**:
   ```bash
   npm run deploy
   ```

### Untuk Postgres di luar Vercel (VPS, Railway, Fly)

`lib/db.ts` tidak peduli di mana database-nya — yang dibutuhkan hanya satu
`DATABASE_URL` yang menunjuk ke PostgreSQL. Kalau self-hosting, `npm start`
sudah cukup dan `vercel.json` tidak dipakai sama sekali.

### File Size
- Production build output: ~250-400 KB compressed
- Database: ~100 KB dengan seed data
- Service worker: ~1 KB

---

## 📊 Architecture Notes

- **No ORM**: All SQL is in `lib/db.ts` (DDL) + `lib/queries/data.ts` (CRUD)
- **Singleton DB**: HMR-safe with `globalThis` pattern in `lib/db.ts`
- **Prepared statement cache**: All queries use cached `StatementSync` objects
- **Auto-grade algorithm**:
  - PG: exact array match (sorted indices)
  - Essay: sum of matched keyword weights / total weights × max points
  - Recompute total on every parent review
- **JWT session** = no session table, smaller DB
- **Email normalization** (`.toLowerCase().trim()`) at signup + login

---

## 📜 License

Proprietary — internal project.

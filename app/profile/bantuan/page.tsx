import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getUserById } from "@/lib/queries/data";
import { SettingsShell } from "@/components/SettingsShell";
import { IconMail, IconMessageCircle, IconHelpCircle, IconArrowRight } from "@/components/Icon";

const FAQ = [
  {
    q: "Bagaimana cara membuat kuis?",
    a: "Klik “Buat Kuis” di menu bawah, isi judul dan mapel, lalu tambahkan soalnya. Ada dua tipe: pilihan ganda (dinilai otomatis) dan essay (dinilai dulu secara otomatis, lalu kamu bisa ubah skornya sendiri).",
  },
  {
    q: "Bagaimana anak saya mengerjakan kuisnya?",
    a: "Buka halaman Share Link, tekan “Bagikan ke anak”, lalu kirim link-nya lewat WhatsApp, Telegram, atau email. Anak cukup membuka link itu — tidak perlu bikin akun dan tidak perlu install apa-apa.",
  },
  {
    q: "Kenapa halaman hasil saya kosong?",
    a: "Hasil baru muncul setelah anak benar-benar menekan tombol Submit. Kalau masih kosong, cek halaman Notifikasi — kanal “Saat anak selesai kuis” bisa dimatikan, dan kuis yang masih berstatus Draft belum bisa dikerjakan sama sekali.",
  },
  {
    q: "Apa itu “Kesulitan per Soal”?",
    a: "Di halaman hasil tiap kuis, EaLearn menghitung berapa persen anak benar di setiap soal dari semua attempt. Soal dengan persentase paling rendah ditandai, supaya kamu tahu bagian mana yang perlu dibahas bareng.",
  },
  {
    q: "Kenapa skor essay tidak langsung final?",
    a: "Jawaban essay dinilai dengan mencocokkan kata kunci, jadi hasilnya hanya saran. Buka detail attempt, geser slider skor, lalu simpan — skor total langsung ikut berubah.",
  },
  {
    q: "Saya lupa password, bagaimana?",
    a: "Belum ada fitur reset otomatis, jadi reset dilakukan manual oleh developer. Hubungi kami lewat email atau WhatsApp — keduanya ada di halaman Masuk dan di halaman Bantuan ini. Sebutkan email akun kamu, nanti passwordnya kami atur ulang.",
  },
  {
    q: "Kalau mau hapus kuis, datanya ikut hilang?",
    a: "Iya. Tombol Hapus di kartu kuis pada halaman Beranda menghapus kuis beserta semua attempt dan jawabannya. Tombolnya ada di setiap kartu, tidak perlu membuka editor dulu.",
  },
  {
    q: "Apakah data anak saya aman?",
    a: "Nama anak diketik sendiri oleh anak saat membuka kuis, dan tidak pernah dikirim ke kanal notifikasi yang kamu matikan. Rinciannya ada di halaman Privasi & Data.",
  },
];

export default async function BantuanPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = await getUserById(session.user.id);
  if (!user) redirect("/login");

  return (
    <SettingsShell
      title="Bantuan"
      subtitle="Pertanyaan yang paling sering masuk, dan cara menghubungi kami."
    >
      <section style={{ marginBottom: 24 }}>
        <h3 className="h-section" style={{ marginBottom: 12 }}>
          FAQ
        </h3>
        <div style={{ display: "grid", gap: 10 }}>
          {FAQ.map((f) => (
            /* <details> gives an accessible expand/collapse with no client JS */
            <details
              key={f.q}
              className="card"
              style={{ padding: 0, overflow: "hidden" }}
            >
              <summary
                style={{
                  padding: 14,
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 14,
                  listStyle: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <span
                  style={{ color: "var(--primary-ink)", display: "flex", flexShrink: 0 }}
                >
                  <IconHelpCircle size={16} />
                </span>
                <span style={{ flex: 1 }}>{f.q}</span>
                <span
                  className="t-soft"
                  style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}
                  aria-hidden="true"
                >
                  ▾
                </span>
              </summary>
              <div
                className="t-soft"
                style={{
                  padding: "0 14px 14px 40px",
                  fontSize: 13,
                  lineHeight: 1.7,
                }}
              >
                {f.a}
              </div>
            </details>
          ))}
        </div>
      </section>

      <section>
        <h3 className="h-section" style={{ marginBottom: 12 }}>
          Kontak
        </h3>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <a
            href="mailto:nrlhuda2904@gmail.com?subject=Bantuan%20EaLearn"
            style={{
              padding: 14,
              display: "flex",
              alignItems: "center",
              gap: 12,
              borderBottom: "1px solid var(--border-soft)",
              textDecoration: "none",
              color: "var(--text)",
            }}
          >
            <span
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: "var(--bg-soft)",
                color: "var(--text-soft)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <IconMail size={20} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Email</div>
              <div className="t-soft" style={{ fontSize: 12 }}>
                nrlhuda2904@gmail.com
              </div>
            </div>
            <IconArrowRight size={14} className="t-muted" />
          </a>

          <a
            href="https://wa.me/6281388853100?text=Halo%20EaLearn%2C%20saya%20butuh%20bantuan"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: 14,
              display: "flex",
              alignItems: "center",
              gap: 12,
              textDecoration: "none",
              color: "var(--text)",
            }}
          >
            <span
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: "var(--bg-soft)",
                color: "var(--text-soft)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <IconMessageCircle size={20} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>WhatsApp</div>
              <div className="t-soft" style={{ fontSize: 12 }}>
                0813 8885 3100 · balasan 1×24 jam kerja
              </div>
            </div>
            <IconArrowRight size={14} className="t-muted" />
          </a>
        </div>
      </section>
    </SettingsShell>
  );
}

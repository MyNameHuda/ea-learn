import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getUserById } from "@/lib/queries/data";
import { SettingsShell } from "@/components/SettingsShell";
import { IconHeart, IconShield, IconZap, IconUser } from "@/components/Icon";

export const metadata = {
  title: "Tentang — EaLearn",
};

const POINTS = [
  {
    icon: IconZap,
    title: "Cepat",
    desc: "Bikin kuis dalam beberapa menit, bukan berjam-jam. Tidak perlu install apa-apa.",
  },
  {
    icon: IconUser,
    title: "Tanpa akun untuk anak",
    desc: "Anak cukup buka link. Tidak perlu email, tidak perlu password, tidak perlu daftar.",
  },
  {
    icon: IconShield,
    title: "Data milikmu",
    desc: "Skor dan jawaban anak tidak dibagikan ke siapa pun. Kamu yang pegang semua datanya.",
  },
  {
    icon: IconHeart,
    title: "Dibuat untuk orang tua",
    desc: "Agak ramah dibaca, tombolnya besar, dan Bahasa Indonesianya lugas.",
  },
];

export default async function TentangPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = await getUserById(session.user.id);
  if (!user) redirect("/login");

  return (
    <SettingsShell title="Tentang">
      <div
        style={{
          background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)",
          color: "#fff",
          borderRadius: "var(--radius-lg)",
          padding: 28,
          textAlign: "center",
          marginBottom: 24,
          boxShadow: "0 8px 24px rgba(107, 124, 92, 0.25)",
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 18,
            background: "rgba(255,255,255,0.18)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 14px",
            fontWeight: 800,
            fontSize: 28,
            fontFamily: "var(--font-display)",
          }}
        >
          E
        </div>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 24,
            fontWeight: 800,
            marginBottom: 4,
          }}
        >
          EaLearn
        </div>
        <div style={{ fontSize: 13, opacity: 0.9 }}>
          Latihan bareng anak, lebih seru
        </div>
        <div
          className="t-tag"
          style={{
            display: "inline-block",
            marginTop: 14,
            background: "rgba(255,255,255,0.18)",
            color: "#fff",
            fontWeight: 600,
          }}
        >
          {/* Was "Versi 0.1". A 0.x number on the About screen told every visitor the
            app was unfinished before they had tried it, which is a bad first
            impression and not a useful thing for a parent to know. */}
        Gratis · tanpa install
        </div>
      </div>

      <section style={{ marginBottom: 24 }}>
        <h3 className="h-section" style={{ marginBottom: 12 }}>
          Yang bikin EaLearn
        </h3>
        <div style={{ display: "grid", gap: 10 }}>
          {POINTS.map((p) => (
            <div
              key={p.title}
              className="card"
              style={{ padding: 14, display: "flex", gap: 12, alignItems: "flex-start" }}
            >
              <span
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: "var(--primary-soft)",
                  color: "var(--primary-ink)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <p.icon size={20} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{p.title}</div>
                <div className="t-soft" style={{ fontSize: 12, marginTop: 2, lineHeight: 1.6 }}>
                  {p.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="card" style={{ padding: 16, lineHeight: 1.8 }}>
        <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Ada yang terasa aneh?</h4>
        <p className="t-soft" style={{ fontSize: 12, margin: 0 }}>
          Kalau ada yang terasa aneh atau error, ceritakan lewat halaman{" "}
          <span style={{ color: "var(--primary-ink)", fontWeight: 600 }}>Bantuan</span>{" "}
          — laporan dari pengguna asli jauh lebih berguna daripada tebakan kami.
        </p>
      </div>
    </SettingsShell>
  );
}

import Link from "next/link";
import {
  IconCheck,
  IconClipboard,
  IconShare,
  IconChart,
  IconList,
  IconPenTool,
  IconSend,
  IconFlask,
} from "@/components/Icon";
import { LogoMark } from "@/components/LogoMark";

const isDev = process.env.NODE_ENV !== "production";

const features = [
  {
    icon: IconClipboard,
    title: "Pilihan Ganda & Essay",
    desc: "Mixed types, max 50 soal per kuis",
    color: "var(--primary)",
    bg: "var(--primary-soft)",
  },
  {
    icon: IconChart,
    title: "Hybrid Grading",
    desc: "Auto-grade PG, manual review essay",
    color: "var(--accent-dark)",
    bg: "var(--accent-soft)",
  },
  {
    icon: IconShare,
    title: "Share via WhatsApp",
    desc: "Anak kerjain langsung dari link",
    // Was a hardcoded sage (#5d7050 / #d4dfc9) — the v4 brand green, left
    // behind as a literal and invisible to any palette change. Tokens now.
    color: "var(--info)",
    bg: "var(--info-soft)",
  },
];

export default function HomePage() {
  return (
    <>
      <div className="bg-aurora bg-aurora-landing" aria-hidden="true" />
      <div className="wide-shell animate-fade-in">
        <div
          style={{
            position: "relative",
            padding: "32px 0 16px",
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 32,
            alignItems: "center",
          }}
        >
          {/* Decorative floating cards — desktop only */}
          <div className="float-card float-card-1" style={{ display: "none" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontWeight: 600,
                color: "var(--primary-ink)",
              }}
            >
              <IconCheck size={13} />
              Auto-graded
            </div>
            <div style={{ fontSize: 12, color: "var(--text-soft)" }}>
              Latihan Pecahan · 10/10
            </div>
          </div>
          <div className="float-card float-card-2" style={{ display: "none" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontWeight: 600,
                color: "var(--accent-ink)",
              }}
            >
              <IconSend size={13} />
              Share ready
            </div>
            <div style={{ fontSize: 12, color: "var(--text-soft)" }}>
              ealearn.id/play/aisah
            </div>
          </div>

          {/* Hero section */}
          <div style={{ textAlign: "center", maxWidth: 720, margin: "0 auto", position: "relative" }}>
            <div className="brand-logo" style={{ justifyContent: "center", marginBottom: 32 }}>
              <LogoMark />
              <span>EaLearn</span>
            </div>
            <h1 className="h-display landing-hero__title">
              Bikin soal latihan untuk anak,
              {/* The <br> is display:none on phones, so it collapses the line
                  break AND the surrounding whitespace — without this the
                  headline rendered as "anak,dalam 5 menit." */}
              <br className="landing-hero__break" />{" "}
              <span style={{ color: "var(--primary)" }}>dalam 5 menit.</span>
            </h1>
            <p className="t-muted landing-hero__sub">
              Bikin kuis, kirim link-nya ke anak lewat WhatsApp, langsung lihat
              hasilnya.
            </p>

            {/* Primary CTA with the secondary directly beneath it. Side by side
                they read as two competing actions of near-equal weight — a
                solid green button next to a borderless ghost one is the worst
                of both. Stacked, the outline variant is unmistakably secondary
                without demoting it to a bare text link, and the equal width
                gives the block a deliberate, aligned column. */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "stretch",
                gap: 12,
                maxWidth: 300,
                margin: "0 auto",
              }}
            >
              {/* Explicit height on both: .btn-outline adds a 1.5px border, so
                  the bordered button measured 53px against the solid one's
                  51px. In a stacked pair that 2px step is plainly visible. */}
              <Link
                href="/signup"
                className="btn btn-primary"
                style={{ width: "100%", height: 52, fontWeight: 700 }}
              >
                Mulai Gratis
              </Link>
              <Link
                href="/login"
                className="btn btn-outline"
                style={{ width: "100%", height: 52, fontWeight: 600 }}
              >
                Sudah punya akun?
              </Link>
            </div>

            {/* Trust row. A loose 18px gap left the three items looking
                unrelated, so they are now separated by hairlines at an even
                rhythm and the tick is tinted to carry the brand. */}
            <div
              className="t-soft"
              style={{
                marginTop: 24,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
                fontSize: 13,
              }}
            >
              {["Gratis selamanya", "Tanpa install app", "Bahasa Indonesia"].map(
                (item, i) => (
                  <span
                    key={item}
                    style={{ display: "inline-flex", alignItems: "center", gap: 12 }}
                  >
                    {i > 0 && (
                      <span
                        aria-hidden="true"
                        className="trust-sep"
                      />
                    )}
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <span
                        style={{ color: "var(--primary)", display: "flex" }}
                        aria-hidden="true"
                      >
                        <IconCheck size={14} />
                      </span>
                      {item}
                    </span>
                  </span>
                ),
              )}
            </div>
          </div>
        </div>

        {/* Features section */}
        <section className="landing-section">
          <h2 className="h-section" style={{ textAlign: "center", fontSize: 20 }}>
            Kenapa EaLearn?
          </h2>
          <p
            className="t-muted"
            style={{ textAlign: "center", marginBottom: 24, maxWidth: 520, margin: "0 auto 24px" }}
          >
            Dirancang khusus untuk flow 1-on-1 antara orang tua dan anak, bukan
            untuk kelas.
          </p>

          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              marginTop: 24,
            }}
          >
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="card"
                  style={{
                    padding: 20,
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 14,
                    flexDirection: "row",
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      background: f.bg,
                      color: f.color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={22} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
                      {f.title}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-soft)", lineHeight: 1.5 }}>
                      {f.desc}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Stats strip */}
        <section
          style={{
            background: "var(--card)",
            borderRadius: "var(--radius-lg)",
            padding: 24,
            boxShadow: "var(--shadow-sm)",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 16,
            textAlign: "center",
            marginBottom: 20,
          }}
        >
          {[
            { num: "5 menit", label: "Bikin kuis" },
            { num: "1 klik", label: "Share ke anak" },
            { num: "Real-time", label: "Lihat hasil" },
            { num: "100%", label: "Gratis" },
          ].map((s) => (
            <div key={s.label}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--primary-dark)" }}>
                {s.num}
              </div>
              <div className="t-soft">{s.label}</div>
            </div>
          ))}
        </section>

        {/* How it works */}
        <section className="landing-section">
          <h2 className="h-section" style={{ textAlign: "center", fontSize: 20, marginBottom: 24 }}>
            Cara pakai (4 langkah)
          </h2>
          <div className="landing-steps">
            {[
              /* Was "Masuk / Pakai akun Google, langsung jadi". Sign-in is back
                 to email + password with a confirm field, so the first step of
                 the journey is registering again. */
              { num: 1, icon: IconList, title: "Daftar", desc: "Cuma email + password, 30 detik" },
              { num: 2, icon: IconPenTool, title: "Bikin kuis", desc: "Pilih PG atau essay" },
              { num: 3, icon: IconSend, title: "Share link", desc: "Kirim via WhatsApp" },
              { num: 4, icon: IconChart, title: "Lihat hasil", desc: "Auto-grade + review" },
            ].map((step) => (
              <div key={step.num} className="card landing-step">
                <div className="landing-step__num">{step.num}</div>
                {/* The 44px icon was dropped on phones: at 2x2 it left no room
                    for the title, and the numbered circle already carries the
                    "step" meaning. Restored at the tablet breakpoint.

                    `display` is set by the class, NOT inline — an inline
                    display:flex would beat the stylesheet's display:none and
                    the icon would never hide. */}
                <div
                  style={{
                    alignItems: "center",
                    justifyContent: "center",
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: "var(--primary-soft)",
                    color: "var(--primary-ink)",
                    marginBottom: 10,
                  }}
                  className="landing-step__icon"
                >
                  <step.icon size={22} />
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    marginBottom: 4,
                    fontSize: 15,
                  }}
                >
                  {step.title}
                </div>
                <div className="t-muted" style={{ fontSize: 12, lineHeight: 1.5 }}>
                  {step.desc}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Pre-prod banner (dev only) */}
        {isDev && (
          <div
            className="card-soft"
            style={{ marginTop: 24, fontSize: 13 }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
              }}
            >
              <span style={{ color: "var(--accent-ink)", flexShrink: 0, marginTop: 2 }}>
                <IconFlask size={16} />
              </span>
              <div>
                <strong style={{ color: "var(--text)" }}>Mode pengembangan</strong>{" "}
                — Isi halaman ini memakai data contoh, bukan akun asli. Jalankan{" "}
                <code>npm run db:seed</code> untuk mengisi ulang.
              </div>
            </div>
          </div>
        )}

        {/* Final CTA */}
        <section
          style={{
            background: "linear-gradient(135deg, var(--primary), var(--primary-dark))",
            borderRadius: "var(--radius-lg)",
            padding: "32px 24px",
            textAlign: "center",
            color: "#fff",
            marginTop: 24,
            marginBottom: 16,
            boxShadow: "0 12px 32px rgba(27, 54, 99, 0.22)",
          }}
        >
          <h2 style={{ color: "#fff", fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
            Siap bikin kuis pertama?
          </h2>
          <p style={{ opacity: 0.9, marginBottom: 20 }}>
            Gratis, tanpa install, tanpa setup ribet.
          </p>
          <Link
            href="/signup"
            className="btn btn-accent"
            style={{ maxWidth: 280, margin: "0 auto" }}
          >
            Mulai Sekarang — Gratis
          </Link>
        </section>
      </div>
    </>
  );
}

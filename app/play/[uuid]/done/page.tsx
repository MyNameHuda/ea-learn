import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  getAttemptById,
  getAttemptSummaryForChild,
  getQuizByShareUuid,
} from "@/lib/queries/data";
import { buildChildSummary, tallyChildSummary } from "@/lib/grading";
import {
  IconArrowRight,
  IconTrophy,
  IconZap,
  IconPenTool,
  IconCheck,
  IconX,
  IconClock,
} from "@/components/Icon";
import { LogoMark } from "@/components/LogoMark";

/**
 * Warna penanda status di atas latar gelap.
 *
 * Token --success / --danger / --warning terlalu gelap untuk teks di atas
 * aurora navy, jadi yang dipakai adalah versi terang dengan alpha rendah
 * untuk latarnya. Kontrasnya tetap terbaca di layar HP.
 */
const STATUS_STYLE: Record<
  string,
  { label: string; bg: string; fg: string; Icon: typeof IconCheck }
> = {
  correct: { label: "Benar", bg: "rgba(126,226,168,0.18)", fg: "#8ee9b4", Icon: IconCheck },
  wrong: { label: "Salah", bg: "rgba(255,157,157,0.18)", fg: "#ffb0b0", Icon: IconX },
  partial: { label: "Sebagian benar", bg: "rgba(252,211,77,0.18)", fg: "#fcd777", Icon: IconZap },
  pending: { label: "Menunggu review", bg: "rgba(255,255,255,0.14)", fg: "#e6edf7", Icon: IconClock },
};

export default async function PlayDonePage({
  params,
  searchParams,
}: {
  params: Promise<{ uuid: string }>;
  searchParams: Promise<{ attempt?: string }>;
}) {
  const { uuid } = await params;
  const { attempt: attemptId } = await searchParams;
  if (!attemptId) {
    redirect(`/play/${uuid}`);
  }

  const quiz = await getQuizByShareUuid(uuid);
  if (!quiz) notFound();

  const attempt = await getAttemptById(attemptId);
  if (!attempt) notFound();
  // Attempt milik kuis lain tidak boleh ditampilkan di halaman kuis ini.
  if (attempt.quizId !== quiz.id) notFound();

  const total = attempt.totalScore ?? 0;
  const max = attempt.maxScore;
  const pct = max > 0 ? Math.round((total / max) * 100) : 0;
  const passed = pct >= 70;

  // Ringkasan jawaban anak: soal, jawaban mereka sendiri, dan benar/salah.
  // Kunci jawaban tidak pernah ikut di sini — query-nya tidak mengambilnya.
  const summary = buildChildSummary(
    await getAttemptSummaryForChild(attempt.id, quiz.id),
  );
  const tally = tallyChildSummary(summary);

  return (
    <>
      <div
        className="bg-aurora"
        style={{
          background:
            "linear-gradient(135deg, var(--brand-navy) 0%, var(--primary) 60%, var(--brand-blue) 100%)",
        }}
        aria-hidden="true"
      />
      <div
        className="shell-mobile-full"
        style={{
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
        }}
      >
        {/*
          justifyContent: "flex-start", bukan "center".

          Halaman ini tadinya satu blok yang dipusatkan, dan itu bagus karena
          isinya pendek. Sekarang ada daftar jawaban yang bisa dozens baris,
          dan flexbox yang dipusatkan plus konten yang lebih panjang dari
          viewport membuat bagian ATAS halaman tidak bisa dijangkau dengan
          scroll di beberapa browser. Isi panjang butuh flow dari atas.
        */}
        <main
          className="animate-fade-in"
          style={{
            flex: 1,
            padding: "32px 16px 48px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            position: "relative",
          }}
        >
          <div
            className="glow-veil"
            style={{
              backgroundImage:
                "radial-gradient(circle at 30% 20%, rgba(255, 255, 255, 0.18) 0%, transparent 45%), radial-gradient(circle at 70% 80%, rgba(212, 165, 116, 0.18) 0%, transparent 50%)",
            }}
          />

          {/* Was a plain "Powered by EaLearn" line of text at the bottom of the
              screen, 11px and half-opacity — the brand was present but not
              visible. The other three screens in this flow (/play/<uuid>,
              /name, /do) all open with the lockup, so this one now matches. */}
          <div className="brand-logo" style={{ color: "#fff", marginBottom: 24 }}>
            <LogoMark onDark />
            <span>EaLearn</span>
          </div>

          <div
            className="animate-floaty"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 96,
              height: 96,
              borderRadius: 28,
              background: "rgba(255,255,255,0.18)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.22)",
              marginBottom: 20,
              boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
            }}
          >
            {passed ? <IconTrophy size={44} /> : <IconZap size={44} />}
          </div>

          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 32,
              fontWeight: 700,
              marginBottom: 8,
              letterSpacing: "-0.02em",
              textAlign: "center",
            }}
          >
            {passed ? "Hebat!" : "Tetap Semangat!"}, {attempt.childName}!
          </h1>
          <p
            style={{
              opacity: 0.92,
              fontSize: 15,
              marginBottom: 24,
              textAlign: "center",
            }}
          >
            {passed
              ? "Kamu lulus dengan nilai bagus."
              : "Yuk latihan lagi supaya makin jago!"}
          </p>

          <div
            style={{
              background: "rgba(255,255,255,0.18)",
              borderRadius: "var(--radius-lg)",
              padding: 24,
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.18)",
              minWidth: 240,
              marginBottom: 28,
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: 12,
                opacity: 0.85,
                marginBottom: 6,
                fontWeight: 600,
                letterSpacing: 1,
              }}
            >
              SKOR PILIHAN GANDA
            </div>
            <div
              style={{
                fontSize: 56,
                fontWeight: 800,
                lineHeight: 1,
                marginBottom: 4,
              }}
            >
              {total}
              <span style={{ fontSize: 24, opacity: 0.7 }}>
                /{max}
              </span>
            </div>
            <div
              style={{
                fontSize: 14,
                opacity: 0.85,
              }}
            >
              {pct}% · {passed ? "Lulus" : "Belum lulus"}
            </div>
            <div
              style={{
                marginTop: 12,
                paddingTop: 12,
                borderTop: "1px solid rgba(255,255,255,0.15)",
                fontSize: 13,
                opacity: 0.85,
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <IconPenTool size={13} />
                Essay sedang direview Bunda
              </span>
            </div>
          </div>

          {/* ── Ringkasan jawaban ────────────────────────────────────────────
              Yang ditampilkan: nomor soal, soal itu sendiri, jawaban anak,
              dan apakah itu benar.

              Yang tidak ditampilkan: jawaban yang benar. Kalau jawabannya
              salah, di sini hanya tertulis nomornya salah. Kuncinya sendiri
              tidak pernah masuk ke jalur ini — query getAttemptSummaryForChild()
              tidak mengambil kolom correct_answer — sehingga tidak ada yang
              bisa bocor karena "lupa dihapus" di suatu tempat. */}
          {summary.length > 0 && (
            <section
              style={{
                width: "100%",
                maxWidth: 460,
                marginBottom: 24,
              }}
            >
              <h2
                style={{
                  fontSize: 17,
                  fontWeight: 800,
                  marginBottom: 4,
                  textAlign: "left",
                }}
              >
                Ringkasan jawaban
              </h2>
              <p
                style={{
                  fontSize: 12,
                  opacity: 0.8,
                  marginBottom: 12,
                  textAlign: "left",
                }}
              >
                {tally.correct} benar
                {tally.wrong > 0 ? ` · ${tally.wrong} salah` : ""}
                {tally.partial > 0 ? ` · ${tally.partial} sebagian benar` : ""}
                {tally.pending > 0 ? ` · ${tally.pending} menunggu review` : ""}
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {summary.map((a) => {
                  const st = STATUS_STYLE[a.status];
                  return (
                    <div
                      key={a.index}
                      style={{
                        display: "flex",
                        gap: 12,
                        padding: 14,
                        borderRadius: "var(--radius-lg)",
                        background: "rgba(255,255,255,0.1)",
                        border: "1px solid rgba(255,255,255,0.15)",
                        textAlign: "left",
                      }}
                    >
                      <div
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: "50%",
                          background: "rgba(255,255,255,0.16)",
                          color: "#fff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                          fontSize: 12,
                          flexShrink: 0,
                        }}
                      >
                        {a.index}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            marginBottom: 6,
                            flexWrap: "wrap",
                          }}
                        >
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              padding: "3px 9px",
                              borderRadius: 999,
                              background: st.bg,
                              color: st.fg,
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            <st.Icon size={12} />
                            {st.label}
                          </span>
                          <span style={{ fontSize: 11, opacity: 0.75 }}>
                            {a.type === "essay" ? "Essay" : "Pilihan ganda"} ·{" "}
                            {a.points} poin
                          </span>
                        </div>

                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 600,
                            marginBottom: 6,
                            lineHeight: 1.35,
                            display: "-webkit-box",
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {a.prompt}
                        </div>

                        <div style={{ fontSize: 13, lineHeight: 1.45 }}>
                          <span style={{ opacity: 0.72 }}>Jawabanmu: </span>
                          <span style={{ fontWeight: 600 }}>
                            {a.given ?? "Tidak dijawab"}
                          </span>
                        </div>

                        {a.scoreLabel && (
                          <div
                            style={{
                              fontSize: 12,
                              opacity: 0.85,
                              marginTop: 4,
                              fontWeight: 600,
                            }}
                          >
                            Nilai dari Bunda: {a.scoreLabel}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <div
            style={{
              fontSize: 13,
              opacity: 0.85,
              maxWidth: 320,
              marginBottom: 24,
              textAlign: "center",
            }}
          >
            Hasil sudah dikirim ke Bunda/Pak kamu. Mereka akan review essay kamu
            dalam beberapa waktu ya!
          </div>

          <Link
            href={`/play/${uuid}`}
            className="btn btn-accent"
            style={{ maxWidth: 280, fontWeight: 700 }}
          >
            Selesai
          </Link>
          <Link
            href={`/play/${uuid}`}
            className="btn btn-ghost"
            style={{ maxWidth: 280, marginTop: 8, color: "#fff" }}
          >
            Kerjain Lagi <IconArrowRight size={16} />
          </Link>
        </main>
      </div>
    </>
  );
}

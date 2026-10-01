import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getAttemptById } from "@/lib/queries/data";
import {
  IconArrowRight,
  IconTrophy,
  IconZap,
  IconPenTool,
} from "@/components/Icon";
import { LogoMark } from "@/components/LogoMark";

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

  const attempt = await getAttemptById(attemptId);
  if (!attempt) notFound();

  const total = attempt.totalScore ?? 0;
  const max = attempt.maxScore;
  const pct = max > 0 ? Math.round((total / max) * 100) : 0;
  const passed = pct >= 70;

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
        <main
          className="animate-fade-in"
          style={{
            flex: 1,
            padding: "40px 24px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            position: "relative",
          }}
        >
          <div
            className="glow-veil"
            style={{
              backgroundImage:
                "radial-gradient(circle at 70% 30%, rgba(255, 255, 255, 0.18) 0%, transparent 45%)",
            }}
          />

          {/* Was a plain "Powered by EaLearn" line of text at the bottom of the
              screen, 11px and half-opacity — the brand was present but not
              visible. The other three screens in this flow (/play/<uuid>,
              /name, /do) all open with the lockup, so this one now matches. */}
          <div className="brand-logo" style={{ color: "#fff", marginBottom: 28 }}>
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
            }}
          >
            {passed ? "Hebat!" : "Tetap Semangat!"}, {attempt.childName}!
          </h1>
          <p
            style={{
              opacity: 0.92,
              fontSize: 15,
              marginBottom: 24,
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
              marginBottom: 32,
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

          <div
            style={{
              fontSize: 13,
              opacity: 0.85,
              maxWidth: 320,
              marginBottom: 24,
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

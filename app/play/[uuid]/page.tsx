import { notFound } from "next/navigation";
import Link from "next/link";
import { getQuizByShareUuid, listQuizQuestions, getUserById } from "@/lib/queries/data";
import { IconArrowRight, IconRocket, IconShield } from "@/components/Icon";
import { LogoMark } from "@/components/LogoMark";

export default async function PlayQuizPage({
  params,
}: {
  params: Promise<{ uuid: string }>;
}) {
  const { uuid } = await params;
  const quiz = await getQuizByShareUuid(uuid);
  if (!quiz || quiz.status !== "ready") notFound();

  const questions = await listQuizQuestions(quiz.id);
  const creator = await getUserById(quiz.userId);

  return (
    <>
      <div
        className="bg-aurora"
        style={{
          background:
            "linear-gradient(135deg, var(--brand-navy) 0%, var(--primary) 55%, var(--brand-blue) 100%)",
        }}
        aria-hidden="true"
      />
      <div
        className="shell-mobile-full"
        style={{
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
          color: "#fff",
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
                "radial-gradient(circle at 30% 20%, rgba(255, 255, 255, 0.18) 0%, transparent 45%), radial-gradient(circle at 70% 80%, rgba(212, 165, 116, 0.18) 0%, transparent 50%)",
            }}
          />

          <div className="brand-logo" style={{ color: "#fff", marginBottom: 32 }}>
            <LogoMark onDark />
            <span>EaLearn</span>
          </div>

          {/* Hero mark */}
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
            <IconRocket size={44} />
          </div>

          <h1
            style={{
              fontSize: 30,
              fontWeight: 800,
              lineHeight: 1.2,
              marginBottom: 8,
              letterSpacing: -0.5,
            }}
          >
            {quiz.title}
          </h1>
          <p style={{ opacity: 0.92, marginBottom: 32, fontSize: 15 }}>
            Dari {creator?.displayName ?? "Orang tua"}
          </p>

          <div
            style={{
              display: "flex",
              gap: 0,
              margin: "16px 0 32px",
              background: "rgba(255,255,255,0.15)",
              padding: 16,
              borderRadius: "var(--radius-lg)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.2)",
              minWidth: 280,
            }}
          >
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 800 }}>
                {questions.length}
              </div>
              <div style={{ fontSize: 11, opacity: 0.85 }}>SOAL</div>
            </div>
            <div style={{ width: 1, background: "rgba(255,255,255,0.2)" }} />
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 800 }}>
                ±{Math.max(1, Math.ceil(questions.length * 0.5))}m
              </div>
              <div style={{ fontSize: 11, opacity: 0.85 }}>MENIT</div>
            </div>
            <div style={{ width: 1, background: "rgba(255,255,255,0.2)" }} />
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 800 }}>
                {quiz.ageRange}
              </div>
              <div style={{ fontSize: 11, opacity: 0.85 }}>TAHUN</div>
            </div>
          </div>

          <Link
            href={`/play/${uuid}/name`}
            className="btn btn-accent"
            style={{ maxWidth: 320, fontWeight: 700 }}
          >
            Mulai Sekarang
            <IconArrowRight size={18} />
          </Link>

          <div
            style={{
              marginTop: 24,
              padding: 14,
              background: "rgba(255,255,255,0.12)",
              borderRadius: "var(--radius)",
              maxWidth: 320,
              fontSize: 13,
              border: "1px solid rgba(255,255,255,0.18)",
              display: "flex",
              alignItems: "center",
              gap: 10,
              textAlign: "left",
            }}
          >
            <span style={{ flexShrink: 0 }}>
              <IconShield size={18} />
            </span>
            <span>
              Tidak perlu bikin akun. Cukup tulis nama, langsung mulai.
            </span>
          </div>
        </main>
      </div>
    </>
  );
}

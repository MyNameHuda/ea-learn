import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import {
  getQuizById,
  getUserById,
  getQuizStats,
  listAttempts,
} from "@/lib/queries/data";
import {
  IconArrowLeft,
  IconShare,
  IconChart,
  IconClipboard,
  IconShare as IconShareAlt,
  IconEdit,
  IconBook,
  IconChild,
  IconClock,
} from "@/components/Icon";
import { timeAgoID } from "@/lib/utils";

export default async function QuizDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = await getUserById(session.user.id);
  if (!user) redirect("/login");

  const { id } = await params;
  const quiz = await getQuizById(id);
  if (!quiz) notFound();
  if (quiz.userId !== user.id) notFound();

  const stats = await getQuizStats(quiz.id);
  const attempts = await listAttempts(quiz.id);
  const isDraft = quiz.status === "draft";
  const recentAttempt = attempts[0];

  // Subject color
  const subjectColor = quiz.subject?.toLowerCase().includes("matematika")
    ? "var(--primary)"
    : quiz.subject?.toLowerCase().includes("ipa")
    ? "var(--accent-dark)"
    : "var(--info)";

  return (
    <>
      <div className="bg-aurora bg-aurora-quiz" aria-hidden="true" />
      <div className="shell-mobile-full" style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <header className="page-header">
          <Link href="/dashboard" className="back" aria-label="Kembali">
            <IconArrowLeft size={20} />
          </Link>
          <h1 style={{ fontSize: 14 }}>{quiz.title}</h1>
          <Link href={`/quiz/${quiz.id}/share`} className="action" aria-label="Share">
            <IconShare size={18} />
          </Link>
        </header>

        <main
          className="animate-fade-in"
          style={{ flex: 1, padding: "16px" }}
        >
          {/* Hero card */}
          <div
            style={{
              position: "relative",
              borderRadius: "var(--radius-lg)",
              padding: "32px 20px 24px",
              background: `linear-gradient(135deg, ${subjectColor} 0%, var(--primary-dark) 100%)`,
              color: "#fff",
              marginBottom: 16,
              overflow: "hidden",
              boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            }}
          >
            <div
              className="glow-veil"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 70% 30%, rgba(255,255,255,0.2) 0%, transparent 40%)",
              }}
            />
            <div style={{ position: "relative" }}>
              <span
                className="t-tag"
                style={{
                  background: isDraft ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.18)",
                  color: "#fff",
                  fontWeight: 600,
                  marginBottom: 12,
                }}
              >
                {isDraft ? "Draft" : "Published"}
              </span>
              <h2 style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.2, marginBottom: 12 }}>
                {quiz.title}
              </h2>
              {quiz.description && (
                <p style={{ fontSize: 13, opacity: 0.92, marginBottom: 16, lineHeight: 1.5 }}>
                  {quiz.description}
                </p>
              )}
              <div style={{ display: "flex", gap: 16, fontSize: 13, opacity: 0.95, flexWrap: "wrap" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <IconBook size={14} />
                  {quiz.subject ?? "Tanpa mapel"}
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <IconChild size={14} />
                  {quiz.ageRange}
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <IconClipboard size={14} />
                  {stats.questions} soal
                </span>
                {quiz.publishedAt && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <IconClock size={14} />
                    {timeAgoID(quiz.publishedAt)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Stats strip */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
              gap: 8,
              marginBottom: 20,
            }}
          >
            <div
              className="card-flat"
              style={{
                padding: 14,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 28, fontWeight: 800, color: "var(--primary-dark)" }}>
                {stats.questions}
              </div>
              <div className="t-soft">Soal</div>
            </div>
            <div
              className="card-flat"
              style={{ padding: 14, textAlign: "center" }}
            >
              <div style={{ fontSize: 28, fontWeight: 800, color: "var(--accent-dark)" }}>
                {stats.attempts}
              </div>
              <div className="t-soft">Attempt</div>
            </div>
            <div
              className="card-flat"
              style={{ padding: 14, textAlign: "center" }}
            >
              <div style={{ fontSize: 28, fontWeight: 800, color: "var(--info)" }}>
                {attempts.filter((a) => a.status === "graded").length}
              </div>
              <div className="t-soft">Selesai</div>
            </div>
          </div>

          {/* Action grid */}
          <h3 className="h-section" style={{ marginBottom: 12 }}>
            Aksi
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 10,
              marginBottom: 20,
            }}
          >
            <ActionCard
              href={`/quiz/${quiz.id}/share`}
              icon={<IconShareAlt size={20} />}
              title="Share Link"
              desc="Bagikan ke anak"
              color="var(--primary)"
              bg="var(--primary-soft)"
            />
            <ActionCard
              href={`/quiz/${quiz.id}/results`}
              icon={<IconChart size={20} />}
              title="Lihat Hasil"
              desc={`${stats.attempts} attempt`}
              color="var(--accent-dark)"
              bg="var(--accent-soft)"
            />
            {/* Two of these four cards used to point at /quiz/<id> — the page
                they sit on. "Edit / Ubah detail" in particular looked like it
                opened the editor and did nothing at all, which is the worst
                kind of dead link: the one you reach for when you want to change
                something.

                The "Detail Kuis" card is gone rather than repointed. This IS the
                detail page, so there is nowhere for it to go; keeping a card
                that offers an action already on screen just to fill the grid
                is decoration pretending to be navigation. */}
            <ActionCard
              href={`/quiz/${quiz.id}/edit`}
              icon={<IconEdit size={20} />}
              title="Edit Soal"
              desc="Ubah soal & poin"
              color="var(--text-soft)"
              bg="var(--bg-soft)"
            />
          </div>

          {/* Recent activity */}
          {recentAttempt && (
            <section>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <h3 className="h-section" style={{ margin: 0 }}>
                  Attempt terakhir
                </h3>
                {/* This section only ever renders attempts[0], so with 2+ attempts
                    the page looked like the others didn't exist — the stat card
                    right above says "2 Attempt" and then one row appears. Say how
                    many there are and where the rest live. */}
                {attempts.length > 1 && (
                  <Link
                    href={`/quiz/${quiz.id}/results`}
                    className="text-link"
                    style={{ fontSize: 12 }}
                  >
                    Lihat semua ({attempts.length})
                  </Link>
                )}
              </div>
              <div
                className="card"
                style={{
                  padding: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    background: "var(--primary-soft)",
                    color: "var(--primary-dark)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: 18,
                  }}
                >
                  {recentAttempt.childName.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{recentAttempt.childName}</div>
                  <div className="t-soft">
                    Skor{" "}
                    {recentAttempt.totalScore != null
                      ? `${recentAttempt.totalScore}/${recentAttempt.maxScore}`
                      : "pending"}
                    {recentAttempt.submittedAt && ` · ${timeAgoID(recentAttempt.submittedAt)}`}
                  </div>
                </div>
                {/* Deep-linked to THIS attempt's breakdown. It used to point at
                    /results, the all-attempts list, so a parent tapping "Lihat"
                    on Aisyah's card landed on a list and had to find Aisyah in
                    it again. */}
                <Link
                  href={`/quiz/${quiz.id}/results/${recentAttempt.id}`}
                  className="text-link"
                  style={{ fontSize: 12 }}
                >
                  Lihat →
                </Link>
              </div>
            </section>
          )}
        </main>
      </div>
    </>
  );
}

function ActionCard({
  href,
  icon,
  title,
  desc,
  color,
  bg,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  color: string;
  bg: string;
}) {
  return (
    <Link
      href={href}
      className="card card-clickable"
      style={{
        padding: 14,
        textAlign: "left",
        textDecoration: "none",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          background: bg,
          color: color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, color: "var(--text)", fontSize: 14 }}>
          {title}
        </div>
        <div className="t-soft" style={{ fontSize: 12 }}>
          {desc}
        </div>
      </div>
    </Link>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  listQuizzes,
  getQuizStats,
  getUserById,
} from "@/lib/queries/data";
import { BottomNav } from "@/components/BottomNav";
import { QuizActions } from "@/components/QuizActions";
import { LogoutButton } from "@/components/LogoutButton";
import {
  IconArrowRight,
  IconCalculator,
  IconBeaker,
  IconBook,
  IconPlus,
  IconClipboard,
  IconUser,
  IconClock,
  IconChart,
  IconList,
  IconCheck,
  type IconComponent,
} from "@/components/Icon";
import { timeAgoID } from "@/lib/utils";

function getSubjectIcon(subject: string | null) {
  const s = (subject ?? "").toLowerCase();
  if (s.includes("matematika")) return IconCalculator;
  if (s.includes("ipa") || s.includes("sains")) return IconBeaker;
  if (s.includes("indonesia") || s.includes("b.indo")) return IconBook;
  return IconClipboard;
}

function getSubjectColor(subject: string | null) {
  const s = (subject ?? "").toLowerCase();
  if (s.includes("matematika")) return { bg: "var(--primary-soft)", fg: "var(--primary-dark)" };
  if (s.includes("ipa") || s.includes("sains")) return { bg: "var(--accent-soft)", fg: "var(--accent-dark)" };
  if (s.includes("indonesia") || s.includes("b.indo")) return { bg: "var(--info-soft)", fg: "var(--info-ink)" };
  return { bg: "var(--bg-soft)", fg: "var(--text-soft)" };
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = await getUserById(session.user.id);
  if (!user) redirect("/login");

  const quizzes = await listQuizzes(user.id);

  // Was the literal string "Halo, Bunda Rina" — the seed account's name,
  // hardcoded into the greeting. Every account saw it, including a brand-new
  // signup that had never heard of Rina. Use the first word of the name the
  // person typed, falling back to the mailbox's local part so a blank
  // display_name still produces a sensible greeting rather than "Halo, ".
  const firstName =
    user.displayName.trim().split(/\s+/)[0] || user.email.split("@")[0] || "Bunda";
  const readyQuizzes = quizzes.filter((q) => q.status === "ready");
  const draftQuizzes = quizzes.filter((q) => q.status === "draft");
  /* One query per quiz, concurrently. A plain `.map(async …)` would build the
     array of Promises but the `await` has to be outside it, so Promise.all
     does the gathering. Sequential awaits here would add a full database
     round-trip per quiz to every dashboard load. */
  const quizStats = new Map(
    await Promise.all(
      quizzes.map(async (q) => [q.id, await getQuizStats(q.id)] as const),
    ),
  );
  const totalResults = quizzes.reduce((s, q) => s + (quizStats.get(q.id)?.attempts ?? 0), 0);

  return (
    <>
      <div className="bg-aurora bg-aurora-dashboard" aria-hidden="true" />
      <div className="shell-mobile-full" style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <header className="page-header">
          <div style={{ width: 36 }} />
          <h1>Dashboard</h1>
          <LogoutButton />
        </header>

        <main
          className="animate-fade-in"
          style={{ flex: 1, padding: "20px 16px 96px" }}
        >
          {/* Welcome card */}
          <div
            style={{
              background:
                "linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)",
              borderRadius: "var(--radius-lg)",
              padding: 24,
              color: "#fff",
              marginBottom: 16,
              boxShadow: "0 8px 24px rgba(107, 124, 92, 0.25)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              className="glow-veil"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 80% 20%, rgba(255,255,255,0.18) 0%, transparent 40%)",
              }}
            />
            <div style={{ position: "relative" }}>
              <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 4 }}>
                Halo, {firstName}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 24,
                  fontWeight: 700,
                  marginBottom: 12,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.15,
                }}
              >
                Mau bikin kuis hari ini?
              </div>
              <Link
                href="/quiz/new"
                className="btn"
                style={{
                  background: "rgba(255,255,255,0.18)",
                  color: "#fff",
                  maxWidth: 200,
                  padding: "10px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  backdropFilter: "blur(8px)",
                }}
              >
                <IconPlus size={16} />
                Buat Kuis Baru
              </Link>
            </div>
          </div>

          {/* Bento grid - stats */}
          <div className="bento" style={{ marginBottom: 24 }}>
            <div
              className="bento-full"
              style={{
                background: "var(--card)",
                borderRadius: "var(--radius-lg)",
                padding: 16,
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 12,
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <StatChip
                icon={IconList}
                label="Total Kuis"
                value={quizzes.length}
                accent="var(--primary-ink)"
              />
              <StatChip
                icon={IconChart}
                label="Hasil"
                value={totalResults}
                accent="var(--accent-ink)"
              />
              <StatChip
                icon={IconCheck}
                label="Aktif"
                value={readyQuizzes.length}
                accent="var(--success-ink)"
              />
            </div>
          </div>

          {/* Empty state */}
          {quizzes.length === 0 && (
            <div
              className="empty-state"
              style={{
                background: "var(--card)",
                borderRadius: "var(--radius-lg)",
                padding: "48px 24px",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, var(--primary-soft) 0%, var(--accent-soft) 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16,
                  color: "var(--primary-ink)",
                }}
              >
                <IconClipboard size={40} />
              </div>
              <h2 className="h-title" style={{ marginBottom: 8 }}>
                Belum ada kuis
              </h2>
              <p className="t-muted" style={{ marginBottom: 20, maxWidth: 320 }}>
                Yuk bikin kuis pertama. Cuma 5 menit, langsung bisa dishare ke anak.
              </p>
              <Link
                href="/quiz/new"
                className="btn btn-primary"
                style={{ maxWidth: 240 }}
              >
                <IconPlus size={16} />
                Buat Kuis Pertama
              </Link>
            </div>
          )}

          {/* Active quizzes */}
          {readyQuizzes.length > 0 && (
            <section style={{ marginBottom: 24 }}>
              <SectionHeader title="Kuis Aktif" count={readyQuizzes.length} />
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: 12,
                }}
              >
                {readyQuizzes.map((q) => {
                  const Icon = getSubjectIcon(q.subject);
                  const colors = getSubjectColor(q.subject);
                  const stats = quizStats.get(q.id) ?? { questions: 0, attempts: 0 };
                  return (
                    /* Not a <Link> wrapper: the CRUD row below contains real
                       buttons, and a <button> inside an <a> is invalid HTML —
                       the browser swallows the click. The card itself is a
                       plain surface and the title is the clickable target. */
                    <div
                      key={q.id}
                      className="card"
                      style={{
                        padding: 16,
                        position: "relative",
                        overflow: "hidden",
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          top: 0,
                          right: 0,
                          width: 80,
                          height: 80,
                          background: colors.bg,
                          borderRadius: "50%",
                          transform: "translate(40px, -40px)",
                          opacity: 0.6,
                        }}
                      />
                      <div
                        style={{
                          position: "relative",
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 12,
                          flex: 1,
                        }}
                      >
                        <div
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 12,
                            background: colors.bg,
                            color: colors.fg,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <Icon size={22} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Link
                            href={`/quiz/${q.id}/results`}
                            className="card-clickable"
                            style={{
                              fontWeight: 600,
                              color: "var(--text)",
                              display: "flex",
                              alignItems: "center",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              marginBottom: 4,
                              /* Was minHeight: 22 — the measured tap target,
                                 which is half the 44px minimum and about the
                                 size of a text line. The row it sits in is a
                                 single tap away from opening the results, so
                                 it has to be reachable on a phone. */
                              minHeight: 44,
                            }}
                          >
                            {q.title}
                          </Link>
                          <div
                            style={{
                              fontSize: 12,
                              color: "var(--text-soft)",
                              display: "flex",
                              gap: 8,
                              flexWrap: "wrap",
                            }}
                          >
                            <span>{q.subject ?? "Tanpa mapel"}</span>
                            <span style={{ color: "var(--text-muted)" }}>·</span>
                            <span>{stats.questions} soal</span>
                            <span style={{ color: "var(--text-muted)" }}>·</span>
                            <span className="t-tag primary" style={{ fontSize: 10 }}>
                              {stats.attempts} attempt
                            </span>
                          </div>
                          {q.publishedAt && (
                            <div
                              style={{
                                fontSize: 11,
                                color: "var(--text-muted)",
                                marginTop: 8,
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              <IconClock size={12} />
                              {timeAgoID(q.publishedAt)}
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{ position: "relative" }}>
                        <QuizActions
                          quizId={q.id}
                          title={q.title}
                          attemptCount={stats.attempts}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Quick actions */}
          <section style={{ marginBottom: 24 }}>
            <h3 className="h-section">Akses cepat</h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: 10,
              }}
            >
              <QuickAction
                href="/quiz/new"
                icon={IconPlus}
                label="Buat Kuis"
                desc="Mulai dari nol"
                color="var(--primary-ink)"
              />
              {/* Was `href={latestAttempt ? /quiz/<id>/results : "/dashboard"}`.

                  Two problems, both invisible until you clicked it:

                  1. With no attempt yet — a brand-new account, or one whose
                     child has not finished a quiz — the href was "/dashboard",
                     the page you were already on. A tile that renders, looks
                     clickable, and does nothing.
                  2. When an attempt did exist it went to a single quiz's
                     results, which is not what "Lihat progress anak" means.

                  /hasil is the cross-quiz results overview, it is reachable
                  from the bottom nav under the same name, and it has a real
                  empty state — so it answers the promise in both cases.
                  The label follows the destination: /hasil lists everything,
                  so "Hasil Terbaru" would be a claim it cannot keep. */}
              <QuickAction
                href="/hasil"
                icon={IconChart}
                label="Hasil"
                desc="Lihat progress anak"
                color="var(--accent-ink)"
              />
              <QuickAction
                href="/profile"
                icon={IconUser}
                label="Profil"
                desc="Akun & pengaturan"
                color="var(--info-ink)"
              />
            </div>
          </section>

          {/* Drafts */}
          {draftQuizzes.length > 0 && (
            <section style={{ marginBottom: 24 }}>
              <h3 className="h-section" style={{ marginBottom: 12 }}>
                Draft
              </h3>
              {/* Stacked rows stretched to ~1170px on desktop, so a dozen
                  drafts became a very long thin scroll. `.list-grid` keeps the
                  phone stack and turns the rows into tiles from 768px up. */}
              <div className="list-grid">
                {draftQuizzes.map((q) => {
                  const Icon = getSubjectIcon(q.subject);
                  const stats = quizStats.get(q.id) ?? { questions: 0, attempts: 0 };
                  return (
                    <div
                      key={q.id}
                      className="card"
                      style={{
                        padding: 12,
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                        opacity: 0.85,
                      }}
                    >
                      <Link
                        href={`/quiz/${q.id}`}
                        style={{
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
                            borderRadius: 10,
                            background: "var(--bg-soft)",
                            color: "var(--text-soft)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <Icon size={20} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 600,
                              color: "var(--text)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {q.title}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-soft)" }}>
                            {stats.questions} soal · Draft
                          </div>
                        </div>
                        <IconArrowRight size={16} className="t-muted" />
                      </Link>
                      <QuizActions
                        quizId={q.id}
                        title={q.title}
                        attemptCount={stats.attempts}
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </main>

        {/* FAB */}
        <Link href="/quiz/new" className="fab" aria-label="Buat kuis baru">
          <IconPlus size={26} />
        </Link>

        <BottomNav />
      </div>
    </>
  );
}

// ===== Local sub-components =====

function StatChip({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: IconComponent;
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginBottom: 8,
          color: accent,
        }}
      >
        <Icon size={22} />
      </div>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 28,
          fontWeight: 700,
          color: accent,
          lineHeight: 1,
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-soft)", marginTop: 4 }}>
        {label}
      </div>
    </div>
  );
}

/**
 * A section title with an optional count pill.
 *
 * The `linkText` prop it used to take is gone. It rendered a "Lihat semua →"
 * link hardcoded to href="/dashboard" — the page it was already on — so it was
 * a link that did nothing. There is also no separate all-quizzes page to send
 * it to, and the grid below already renders every quiz in the section with no
 * slice, so nothing was hidden for it to reveal. A link that goes nowhere is
 * worse than no link.
 */
function SectionHeader({
  title,
  count,
}: {
  title: string;
  count?: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
      }}
    >
      <h3 className="h-section" style={{ margin: 0 }}>
        {title}
        {count !== undefined && (
          <span
            style={{
              marginLeft: 8,
              fontSize: 12,
              background: "var(--bg-soft)",
              color: "var(--text-soft)",
              padding: "2px 8px",
              borderRadius: 999,
            }}
          >
            {count}
          </span>
        )}
      </h3>
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
  desc,
  color,
}: {
  href: string;
  icon: IconComponent;
  label: string;
  desc: string;
  color: string;
}) {
  return (
    <Link
      href={href}
      className="card card-clickable"
      style={{
        padding: 16,
        textAlign: "center",
        textDecoration: "none",
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          margin: "0 auto 10px",
          borderRadius: 12,
          background: "var(--bg-soft)",
          color: color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={22} />
      </div>
      <div style={{ fontWeight: 600, color: "var(--text)", fontSize: 14 }}>
        {label}
      </div>
      <div className="t-soft" style={{ marginTop: 2 }}>
        {desc}
      </div>
    </Link>
  );
}

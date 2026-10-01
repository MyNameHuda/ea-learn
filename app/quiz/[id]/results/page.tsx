import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import {
  getQuizById,
  getUserById,
  listAttempts,
  getAttemptStats,
  getQuizAttemptBreakdowns,
  getQuizQuestionPerformance,
} from "@/lib/queries/data";
import { BottomNav } from "@/components/BottomNav";
import {
  IconArrowLeft,
  IconArrowRight,
  IconInbox,
  IconChart,
  IconPenTool,
  IconCheck,
  IconX,
  IconShare,
  IconClock,
  IconTarget,
  IconAlertTriangle,
} from "@/components/Icon";
import { timeAgoID, durationID, durationFromMs } from "@/lib/utils";

/**
 * Sort options for the attempt timeline.
 *
 * Server-side via searchParams rather than client state: the order survives a
 * reload, the control works without JS, and the URL can be shared/bookmarked.
 */
const SORTS = [
  { key: "terbaru", label: "Terbaru", hint: "paling akhir dikerjakan" },
  { key: "terlama", label: "Terlama", hint: "paling awal" },
  { key: "skor-tinggi", label: "Skor Tertinggi", hint: "skor besar dulu" },
  { key: "skor-rendah", label: "Skor Terendah", hint: "skor kecil dulu" },
  { key: "tercepat", label: "Tercepat", hint: "waktu pengerjaan paling singkat" },
  { key: "terlambat", label: "Terlambat", hint: "waktu pengerjaan paling lama" },
] as const;

type SortKey = (typeof SORTS)[number]["key"];

const SORT_KEYS = new Set<string>(SORTS.map((s) => s.key));

export default async function ResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sort?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = await getUserById(session.user.id);
  if (!user) redirect("/login");

  const { id } = await params;
  const quiz = await getQuizById(id);
  if (!quiz) notFound();
  if (quiz.userId !== user.id) notFound();

  const { sort } = await searchParams;
  const sortKey: SortKey =
    sort && SORT_KEYS.has(sort) ? (sort as SortKey) : "terbaru";

  const attempts = await listAttempts(quiz.id);
  const stats = await getAttemptStats(quiz.id);
  const breakdowns = new Map(
    (await getQuizAttemptBreakdowns(quiz.id)).map((b) => [b.attemptId, b]),
  );
  const performance = await getQuizQuestionPerformance(quiz.id);

  // Group by score tier for visual variety
  const graded = attempts.filter((a) => a.status === "graded" && a.totalScore != null);
  const passCount = graded.filter((a) =>
    a.totalScore != null ? (a.totalScore / a.maxScore) * 100 >= 70 : false,
  ).length;
  const passRate = graded.length > 0 ? Math.round((passCount / graded.length) * 100) : 0;

  const pctOf = (a: (typeof attempts)[number]) =>
    a.totalScore != null ? (a.totalScore / a.maxScore) * 100 : -1;
  // Two different numbers, easy to confuse: how LONG it took vs WHEN it landed.
  // "terbaru"/"terlama" must order by the timestamp; only
  // "tercepat"/"terlambat" order by the span.
  const msOf = (a: (typeof attempts)[number]) => {
    if (!a.startedAt || !a.submittedAt) return Number.POSITIVE_INFINITY;
    const ms = new Date(a.submittedAt).getTime() - new Date(a.startedAt).getTime();
    return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
  };
  const tsOf = (a: (typeof attempts)[number]) => {
    const iso = a.submittedAt ?? a.startedAt;
    if (!iso) return Number.NEGATIVE_INFINITY;
    const t = new Date(iso).getTime();
    return Number.isFinite(t) ? t : Number.NEGATIVE_INFINITY;
  };

  const sorted = [...attempts].sort((x, y) => {
    // Primary key per the chosen sort, then a deterministic tiebreak. Without
    // it, two attempts with the same score (or the same duration) can swap
    // places between renders, which reads as the sort being broken.
    let primary = 0;
    switch (sortKey) {
      case "terlama":
        primary = tsOf(x) - tsOf(y);
        break;
      case "skor-tinggi":
        primary = pctOf(y) - pctOf(x);
        break;
      case "skor-rendah":
        primary = pctOf(x) - pctOf(y);
        break;
      case "tercepat":
        primary = msOf(x) - msOf(y);
        break;
      case "terlambat":
        primary = msOf(y) - msOf(x);
        break;
      case "terbaru":
      default:
        primary = tsOf(y) - tsOf(x);
    }
    if (primary !== 0) return primary;
    const byTime = tsOf(y) - tsOf(x);
    if (byTime !== 0) return byTime;
    return x.childName.localeCompare(y.childName, "id");
  });

  // Fastest / slowest among attempts that actually have a duration.
  const timed = attempts.filter((a) => durationID(a.startedAt, a.submittedAt));
  const fastestMs = timed.length ? Math.min(...timed.map(msOf)) : null;
  const slowestMs = timed.length ? Math.max(...timed.map(msOf)) : null;

  // Questions that were actually attempted at least once, worst hit rate first.
  const attempted = performance.filter((q) => q.answered > 0);
  const hardest = [...attempted]
    .map((q) => ({ ...q, rate: Math.round((q.correct / q.answered) * 100) }))
    .sort((x, y) => x.rate - y.rate || y.answered - x.answered);

  const showSort = attempts.length > 1;
  const showPerformance = hardest.length > 0;

  return (
    <>
      <div className="bg-aurora bg-aurora-dashboard" aria-hidden="true" />
      <div className="shell-mobile-full" style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <header className="page-header">
          <Link href="/dashboard" className="back" aria-label="Kembali">
            <IconArrowLeft size={20} />
          </Link>
          <h1 style={{ fontSize: 14 }}>{quiz.title}</h1>
          <Link
            href={`/quiz/${quiz.id}/share`}
            className="action"
            aria-label="Share"
          >
            <IconShare size={18} />
          </Link>
        </header>

        <main
          className="animate-fade-in"
          style={{ flex: 1, padding: "20px 16px 96px" }}
        >
          {/* Stats hero */}
          {stats.total > 0 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                marginBottom: 24,
              }}
            >
              <div
                style={{
                  background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)",
                  color: "#fff",
                  borderRadius: "var(--radius-lg)",
                  padding: 20,
                  gridColumn: "span 2",
                  textAlign: "center",
                  boxShadow: "0 8px 20px rgba(107, 124, 92, 0.25)",
                }}
              >
                <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 4 }}>
                  Tingkat Kelulusan
                </div>
                <div style={{ fontSize: 36, fontWeight: 800, lineHeight: 1 }}>
                  {passRate}
                  <span style={{ fontSize: 18, opacity: 0.85 }}>%</span>
                </div>
                <div style={{ fontSize: 11, opacity: 0.85 }}>
                  {passCount} dari {graded.length} attempt lulus (skor ≥ 70%)
                </div>
              </div>

              <div
                className="card-flat"
                style={{ padding: 14, textAlign: "center" }}
              >
                <div style={{ fontSize: 22, fontWeight: 800, color: "var(--primary-dark)" }}>
                  {stats.avgScore ?? "—"}
                </div>
                <div className="t-soft">Rata-rata</div>
              </div>
              <div
                className="card-flat"
                style={{ padding: 14, textAlign: "center" }}
              >
                <div style={{ fontSize: 22, fontWeight: 800, color: "var(--accent-dark)" }}>
                  {stats.total}
                </div>
                <div className="t-soft">Total attempt</div>
              </div>

              {/* Completion time was un-showable until finalizeAttemptScore
                  started writing submitted_at — every attempt had NULL there,
                  so the whole column of "kapan" and "berapa lama" was blank. */}
              {fastestMs !== null && (
                <div
                  className="card-flat"
                  style={{ padding: 14, textAlign: "center" }}
                >
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 800,
                      color: "var(--info-ink)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    <IconClock size={18} />
                    {durationFromMs(fastestMs) ?? "—"}
                  </div>
                  <div className="t-soft">Tercepat</div>
                </div>
              )}
              {slowestMs !== null && (
                <div
                  className="card-flat"
                  style={{ padding: 14, textAlign: "center" }}
                >
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 800,
                      color: "var(--text-soft)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    <IconClock size={18} />
                    {durationFromMs(slowestMs) ?? "—"}
                  </div>
                  <div className="t-soft">Terlambat</div>
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {attempts.length === 0 && (
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
                  width: 88,
                  height: 88,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, var(--primary-soft) 0%, var(--accent-soft) 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16,
                  color: "var(--primary-ink)",
                }}
              >
                <IconInbox size={38} />
              </div>
              <h2 className="h-title" style={{ marginBottom: 8 }}>
                Belum ada hasil
              </h2>
              <p className="t-muted" style={{ maxWidth: 280, marginBottom: 20 }}>
                Share link ke anak dulu. Hasil akan muncul di sini secara real-time setelah anak submit.
              </p>
              <Link
                href={`/quiz/${quiz.id}/share`}
                className="btn btn-primary"
                style={{ maxWidth: 240 }}
              >
                <IconShare size={16} />
                Share Link Sekarang
              </Link>
            </div>
          )}

          {/* Timeline */}
          {attempts.length > 0 && (
            <section>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 16,
                }}
              >
                <h3
                  className="h-section"
                  style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}
                >
                  <span style={{ color: "var(--primary-ink)", display: "flex" }}>
                    <IconChart size={18} />
                  </span>
                  Timeline Attempt
                </h3>
                <span className="t-tag">{stats.total} total</span>
              </div>

              {/* Sorting. Server-side through ?sort= so the chosen order
                  survives a reload, works without JS, and is shareable. */}
              {showSort && (
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    flexWrap: "wrap",
                    marginBottom: 16,
                  }}
                  role="group"
                  aria-label="Urutkan attempt"
                >
                  {SORTS.map((s) => {
                    const active = s.key === sortKey;
                    return (
                      <Link
                        key={s.key}
                        href={`/quiz/${quiz.id}/results?sort=${s.key}`}
                        scroll={false}
                        aria-pressed={active}
                        title={s.hint}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: active ? 700 : 500,
                          textDecoration: "none",
                          whiteSpace: "nowrap",
                          minHeight: 32,
                          display: "inline-flex",
                          alignItems: "center",
                          background: active
                            ? "var(--primary)"
                            : "var(--card)",
                          color: active ? "#fff" : "var(--text-soft)",
                          border: `1px solid ${
                            active ? "var(--primary)" : "var(--border)"
                          }`,
                        }}
                      >
                        {s.label}
                      </Link>
                    );
                  })}
                </div>
              )}

              <div style={{ position: "relative" }}>
                {/* Timeline vertical line */}
                <div
                  style={{
                    position: "absolute",
                    left: 19,
                    top: 12,
                    bottom: 12,
                    width: 2,
                    background: "var(--border-soft)",
                  }}
                  aria-hidden="true"
                />
                {sorted.map((a) => {
                  const isGraded = a.status === "graded";
                  const pct = isGraded && a.totalScore != null
                    ? Math.round((a.totalScore / a.maxScore) * 100)
                    : null;
                  const passed = pct !== null && pct >= 70;
                  const isEssay = !isGraded;
                  const dur = durationID(a.startedAt, a.submittedAt);
                  const bd = breakdowns.get(a.id);
                  const correct = bd?.correct ?? 0;
                  const answered = bd?.answered ?? 0;
                  const isFastest =
                    fastestMs !== null && msOf(a) === fastestMs && dur !== null;
                  const isSlowest =
                    slowestMs !== null &&
                    msOf(a) === slowestMs &&
                    fastestMs !== slowestMs &&
                    dur !== null;

                  return (
                    <div
                      key={a.id}
                      style={{
                        display: "flex",
                        gap: 16,
                        marginBottom: 12,
                        position: "relative",
                      }}
                    >
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: "50%",
                          background: isEssay
                            ? "var(--warning-soft)"
                            : passed
                            ? "var(--primary-soft)"
                            : "var(--danger-soft)",
                          color: isEssay
                            ? "var(--accent-dark)"
                            : passed
                            ? "var(--primary-dark)"
                            : "var(--danger-ink)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          zIndex: 1,
                          fontWeight: 700,
                          fontSize: 12,
                          border: "3px solid var(--bg)",
                        }}
                      >
                        {isEssay ? (
                          <IconPenTool size={13} />
                        ) : passed ? (
                          <span style={{ display: "flex" }}>
                            <IconCheck size={13} />
                          </span>
                        ) : (
                          <span style={{ display: "flex" }}>
                            <IconX size={13} />
                          </span>
                        )}
                      </div>
                      {/* The whole row opens the per-question breakdown.
                          This card used to be a plain <div>, which left
                          /quiz/<id>/results/<attempt> completely unreachable —
                          the page existed and rendered fine, but nothing in
                          the app linked to it, so a parent could only ever see
                          the score total, never what the child actually
                          answered. */}
                      <Link
                        href={`/quiz/${quiz.id}/results/${a.id}`}
                        className="card-flat"
                        style={{
                          flex: 1,
                          padding: 12,
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          textDecoration: "none",
                          color: "inherit",
                        }}
                      >
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: "50%",
                            background: "var(--primary-soft)",
                            color: "var(--primary-dark)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 700,
                            fontSize: 14,
                            flexShrink: 0,
                          }}
                        >
                          {a.childName.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: "var(--text)" }}>
                            {a.childName}
                          </div>
                          {pct !== null ? (
                            <div className="t-soft" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                              <span style={{ fontWeight: 600, color: passed ? "var(--primary-dark)" : "var(--danger-ink)" }}>
                                {pct}%
                              </span>
                              <span>
                                ({a.totalScore}/{a.maxScore})
                              </span>
                              {answered > 0 && (
                                <>
                                  <span style={{ color: "var(--text-muted)" }}>·</span>
                                  <span>{correct}/{answered} soal benar</span>
                                </>
                              )}
                            </div>
                          ) : (
                            <div className="t-soft">Belum dinilai</div>
                          )}

                          {/* Completion time + when it was handed in. Both were
                              blank on every attempt before submitted_at was
                              actually being written. */}
                          {(dur || a.submittedAt) && (
                            <div
                              className="t-soft"
                              style={{
                                marginTop: 4,
                                fontSize: 11,
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                flexWrap: "wrap",
                              }}
                            >
                              {dur && (
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                    color: isFastest
                                      ? "var(--success-ink)"
                                      : isSlowest
                                      ? "var(--accent-ink)"
                                      : "var(--text-muted)",
                                    fontWeight: isFastest || isSlowest ? 600 : 400,
                                  }}
                                >
                                  <IconClock size={12} />
                                  {dur}
                                </span>
                              )}
                              {dur && a.submittedAt && (
                                <span style={{ color: "var(--text-muted)" }}>·</span>
                              )}
                              {a.submittedAt && <span>{timeAgoID(a.submittedAt)}</span>}
                              {isFastest && (
                                <span className="t-tag success" style={{ fontSize: 10 }}>
                                  tercepat
                                </span>
                              )}
                              {isSlowest && (
                                <span className="t-tag" style={{ fontSize: 10 }}>
                                  terlambat
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <span
                          style={{ color: "var(--text-muted)", display: "flex", flexShrink: 0 }}
                          aria-hidden="true"
                        >
                          <IconArrowRight size={14} />
                        </span>
                      </Link>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Per-question difficulty — the part a score total can never tell
              you. With two attempts you learn nothing from "33%", but you
              immediately learn which specific question is the sticking point
              and what to re-teach. */}
          {showPerformance && (
            <section>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 6,
                }}
              >
                <h3
                  className="h-section"
                  style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}
                >
                  <span style={{ color: "var(--accent-ink)", display: "flex" }}>
                    <IconTarget size={18} />
                  </span>
                  Kesulitan per Soal
                </h3>
                <span className="t-tag">{attempted.length} soal</span>
              </div>
              <p className="t-soft" style={{ marginBottom: 14, fontSize: 12 }}>
                Berapa persen anak benar di tiap soal, dihitung dari semua attempt.
              </p>

              <div className="list-grid">
                {hardest.map((q, i) => {
                  const rate = q.rate;
                  const tone =
                    rate >= 70
                      ? { bg: "var(--primary-soft)", fg: "var(--primary-dark)" }
                      : rate >= 40
                      ? { bg: "var(--warning-soft)", fg: "var(--accent-dark)" }
                      : { bg: "var(--danger-soft)", fg: "var(--danger-ink)" };

                  return (
                    <div
                      key={q.questionId}
                      className="card-flat"
                      style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                        <span
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 6,
                            background: "var(--bg-soft)",
                            color: "var(--text-soft)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 11,
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {/* Positional, not q.orderIndex: the stored
                              order_index is not consistently 0- or 1-based
                              across quizzes, so adding 1 to it renumbered
                              Test 1 as "2". The query already returns rows in
                              question order, so the array position is right. */}
                          {i + 1}
                        </span>
                        <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, lineHeight: 1.4 }}>
                          {q.prompt}
                        </div>
                      </div>

                      <div
                        style={{
                          height: 8,
                          borderRadius: 999,
                          background: "var(--bg-soft)",
                          overflow: "hidden",
                        }}
                        role="img"
                        aria-label={`${q.correct} benar dari ${q.answered} percobaan`}
                      >
                        <div
                          style={{
                            width: `${rate}%`,
                            height: "100%",
                            background: tone.fg,
                            transition: "width 0.3s ease",
                          }}
                        />
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          fontSize: 11,
                        }}
                      >
                        <span className="t-soft">
                          {q.correct} benar · {q.answered - q.correct} salah dari{" "}
                          {q.answered}×
                        </span>
                        <span
                          className="t-tag"
                          style={{ background: tone.bg, color: tone.fg, fontWeight: 700 }}
                        >
                          {rate}%
                        </span>
                      </div>

                      {rate < 40 && q.answered > 0 && (
                        <div
                          style={{
                            display: "flex",
                            gap: 6,
                            alignItems: "flex-start",
                            fontSize: 11,
                            lineHeight: 1.5,
                            color: "var(--danger-ink)",
                            background: "var(--danger-soft)",
                            padding: "8px 10px",
                            borderRadius: "var(--radius-sm)",
                          }}
                        >
                          <span style={{ display: "flex", flexShrink: 0, marginTop: 1 }}>
                            <IconAlertTriangle size={13} />
                          </span>
                          <span>Soal ini paling sering dikeluarin — cocok buat dibahas bareng.</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </main>

        <BottomNav />
      </div>
    </>
  );
}

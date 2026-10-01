import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getUserById, listQuizResultsRollup } from "@/lib/queries/data";
import { BottomNav } from "@/components/BottomNav";
import {
  IconChart,
  IconInbox,
  IconArrowRight,
  IconPenTool,
  IconClock,
  IconTrophy,
} from "@/components/Icon";
import { timeAgoID } from "@/lib/utils";

/**
 * /hasil — the cross-quiz results overview.
 *
 * The topbar's "Hasil" item pointed at `/dashboard#hasil`, and no element with
 * that id exists anywhere in the app, so the nav item scrolled nowhere. There
 * was no results overview page at all: the only results view was
 * /quiz/<id>/results, reachable only by already knowing which quiz to open.
 */
export default async function HasilPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = await getUserById(session.user.id);
  if (!user) redirect("/login");

  const rollups = await listQuizResultsRollup(user.id);
  const withResults = rollups.filter((r) => r.attempts > 0);
  const noResults = rollups.filter((r) => r.attempts === 0);
  const totalAttempts = withResults.reduce((n, r) => n + r.attempts, 0);

  return (
    <>
      <div className="bg-aurora bg-aurora-dashboard" aria-hidden="true" />
      <div
        className="shell-mobile-full"
        style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}
      >
        <header className="page-header">
          <div style={{ width: 36 }} />
          <h1>Hasil</h1>
          <div style={{ width: 36 }} />
        </header>

        <main
          className="animate-fade-in"
          style={{ flex: 1, padding: "20px 16px 96px" }}
        >
          {rollups.length === 0 ? (
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
                  background:
                    "linear-gradient(135deg, var(--primary-soft) 0%, var(--accent-soft) 100%)",
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
                Belum ada kuis
              </h2>
              <p className="t-muted" style={{ maxWidth: 280, marginBottom: 20 }}>
                Buat kuis dulu, lalu share ke anak. Semua hasil akan muncul di
                sini.
              </p>
              <Link
                href="/quiz/new"
                className="btn btn-primary"
                style={{ maxWidth: 240 }}
              >
                Buat Kuis
              </Link>
            </div>
          ) : (
            <>
              {totalAttempts > 0 && (
                <div
                  style={{
                    background:
                      "linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)",
                    color: "#fff",
                    borderRadius: "var(--radius-lg)",
                    padding: 20,
                    textAlign: "center",
                    marginBottom: 24,
                    boxShadow: "0 8px 20px rgba(107, 124, 92, 0.25)",
                  }}
                >
                  <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 4 }}>
                    Total jawaban anak
                  </div>
                  <div style={{ fontSize: 36, fontWeight: 800, lineHeight: 1 }}>
                    {totalAttempts}
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.85 }}>
                    dari {withResults.length} kuis yang sudah dikerjakan
                  </div>
                </div>
              )}

              {withResults.length > 0 && (
                <section style={{ marginBottom: 24 }}>
                  <h3
                    className="h-section"
                    style={{
                      marginBottom: 12,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span
                      style={{ color: "var(--primary-ink)", display: "flex" }}
                    >
                      <IconChart size={18} />
                    </span>
                    Sudah Dikerjakan
                  </h3>

                  <div className="list-grid">
                    {withResults.map((r) => {
                      const passed = (r.latestPct ?? 0) >= 70;
                      return (
                        <Link
                          key={r.id}
                          href={`/quiz/${r.id}/results`}
                          style={{ textDecoration: "none", display: "block" }}
                        >
                          <div
                            className="card card-clickable"
                            style={{
                              padding: 16,
                              height: "100%",
                              display: "flex",
                              flexDirection: "column",
                              gap: 12,
                            }}
                          >
                            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                              <div
                                style={{
                                  width: 44,
                                  height: 44,
                                  borderRadius: 12,
                                  background: "var(--primary-soft)",
                                  color: "var(--primary-dark)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  flexShrink: 0,
                                }}
                              >
                                <IconTrophy size={22} />
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
                                  {r.title}
                                </div>
                                <div
                                  className="t-soft"
                                  style={{ fontSize: 12, display: "flex", gap: 6, flexWrap: "wrap" }}
                                >
                                  <span>{r.subject ?? "Tanpa mapel"}</span>
                                  <span style={{ color: "var(--text-muted)" }}>·</span>
                                  {/* No " tahun" appended. The age is now
                                      whatever the parent typed — "9-12",
                                      "kelas 4", "TK B" — so a hardcoded
                                      unit would read "kelas 4 tahun". */}
                                  <span>{r.ageRange}</span>
                                </div>
                              </div>
                              {r.latestPct !== null && (
                                <span
                                  className="t-tag"
                                  style={{
                                    background: passed
                                      ? "var(--primary-soft)"
                                      : "var(--danger-soft)",
                                    color: passed
                                      ? "var(--primary-ink)"
                                      : "var(--danger-ink)",
                                    fontWeight: 700,
                                    flexShrink: 0,
                                  }}
                                >
                                  {r.latestPct}%
                                </span>
                              )}
                            </div>

                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr 1fr",
                                gap: 8,
                                padding: "10px 0",
                                borderTop: "1px solid var(--border-soft)",
                                borderBottom: "1px solid var(--border-soft)",
                              }}
                            >
                              <div>
                                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
                                  {r.attempts}
                                </div>
                                <div className="t-soft" style={{ fontSize: 10 }}>
                                  Attempt
                                </div>
                              </div>
                              <div>
                                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
                                  {r.avgPct ?? "—"}%
                                </div>
                                <div className="t-soft" style={{ fontSize: 10 }}>
                                  Rata-rata
                                </div>
                              </div>
                              <div>
                                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
                                  {r.passCount}
                                </div>
                                <div className="t-soft" style={{ fontSize: 10 }}>
                                  Lulus
                                </div>
                              </div>
                            </div>

                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 8,
                              }}
                            >
                              <span
                                className="t-soft"
                                style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}
                              >
                                <IconClock size={12} />
                                {r.latestChild
                                  ? `${r.latestChild} · ${timeAgoID(r.latestAt)}`
                                  : "Belum ada jawaban"}
                              </span>
                              <span
                                style={{ color: "var(--text-muted)", display: "flex", flexShrink: 0 }}
                                aria-hidden="true"
                              >
                                <IconArrowRight size={14} />
                              </span>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              )}

              {noResults.length > 0 && (
                <section>
                  <h3 className="h-section" style={{ marginBottom: 12 }}>
                    Belum ada jawaban
                  </h3>
                  <div className="list-grid">
                    {noResults.map((r) => (
                      <Link
                        key={r.id}
                        href={`/quiz/${r.id}`}
                        style={{ textDecoration: "none", display: "block" }}
                      >
                        <div
                          className="card card-clickable"
                          style={{
                            padding: 14,
                            height: "100%",
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            opacity: 0.85,
                          }}
                        >
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 10,
                              background: "var(--bg-soft)",
                              color: "var(--text-soft)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            <IconPenTool size={18} />
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
                              {r.title}
                            </div>
                            <div className="t-soft" style={{ fontSize: 11 }}>
                              {r.status === "ready"
                                ? "Sudah dibagikan — belum dikerjakan"
                                : "Masih draft — share dulu ke anak"}
                            </div>
                          </div>
                          <span
                            style={{ color: "var(--text-muted)", display: "flex", flexShrink: 0 }}
                            aria-hidden="true"
                          >
                            <IconArrowRight size={14} />
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </main>

        <BottomNav />
      </div>
    </>
  );
}

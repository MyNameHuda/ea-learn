"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import {
  IconCheck,
  IconX,
  IconPenTool,
  IconClipboard,
} from "@/components/Icon";

export type AttemptAnswer = {
  id: string;
  question_id: string;
  question_index: number;
  prompt: string;
  type: "multiple_choice" | "essay";
  response: string;
  options?: string[];
  correct_answer?: number[];
  /** Optional figure, so the parent reviews the same question the child saw. */
  image_url?: string | null;
  keywords?: string[];
  keyword_weights?: number[];
  auto_score: number | null;
  final_score: number | null;
  parent_comment: string | null;
  points: number;
};

type QuizInfo = {
  id: string;
  title: string;
};

type AttemptInfo = {
  id: string;
  child_name: string;
  total_score: number;
  max_score: number;
  submitted_at: string | null;
};

export function AttemptDetail({
  quiz,
  attempt,
  answers,
}: {
  quiz: QuizInfo;
  attempt: AttemptInfo;
  answers: AttemptAnswer[];
}) {
  const { showToast } = useToast();
  const [essayScores, setEssayScores] = useState<Record<string, number>>(
    () =>
      Object.fromEntries(
        answers.map((a) => [a.id, a.final_score ?? a.auto_score ?? 0]),
      ),
  );
  const [comments, setComments] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      answers.map((a) => [a.id, a.parent_comment ?? ""]),
    ),
  );
  const [saving, startSave] = useTransition();
  const [totalScore, setTotalScore] = useState(attempt.total_score);

  async function saveReview(answerId: string) {
    startSave(async () => {
      const res = await fetch(`/api/attempt/${attempt.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answerId,
          finalScore: essayScores[answerId] ?? 0,
          parentComment: comments[answerId] ?? null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(
          `Disimpan! Total: ${data.totalScore}/${data.maxScore}`,
          "success",
        );
        setTotalScore(data.totalScore);
      } else {
        showToast(data.error || "Gagal", "error");
      }
    });
  }

  const isCorrectMC = (a: AttemptAnswer): boolean | null => {
    if (a.type !== "multiple_choice" || !a.correct_answer) return null;
    try {
      const got = JSON.parse(a.response || "[]") as number[];
      const want = a.correct_answer;
      return (
        got.length === want.length &&
        [...got].sort().every((v, i) => v === [...want].sort()[i])
      );
    } catch {
      return null;
    }
  };

  return (
    <>
      <div className="bg-aurora bg-aurora-quiz" aria-hidden="true" />
      <div
        className="shell-mobile-full"
        style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}
      >
        <header className="page-header">
          <Link href={`/quiz/${quiz.id}/results`} className="back">
            ‹
          </Link>
          <h1 style={{ fontSize: 13 }}>Detail Hasil</h1>
          <div style={{ width: 36 }} />
        </header>

        <main
          className="animate-fade-in"
          style={{ flex: 1, padding: "16px", paddingBottom: 40 }}
        >
          <div
            className="card"
            style={{ padding: 16, marginBottom: 16, textAlign: "center" }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>
              {attempt.child_name}
            </h2>
            <div className="t-soft" style={{ marginBottom: 12 }}>
              {attempt.submitted_at
                ? new Date(attempt.submitted_at).toLocaleString("id-ID")
                : ""}
            </div>
            <div
              style={{
                fontSize: 36,
                fontWeight: 800,
                color: "var(--primary-dark)",
                lineHeight: 1,
              }}
            >
              {totalScore}
              <span style={{ fontSize: 18, color: "var(--text-soft)" }}>
                /{attempt.max_score}
              </span>
            </div>
            <div className="t-muted">Total poin (setelah review)</div>
          </div>

          <h3 className="h-section" style={{ marginBottom: 12 }}>
            Breakdown per Soal ({answers.length})
          </h3>

          {answers.map((a, idx) => {
            const mcCorrect = isCorrectMC(a);
            const finalScore = essayScores[a.id] ?? 0;
            const comment = comments[a.id] ?? "";

            return (
              <div
                key={a.id}
                className="card"
                style={{ marginBottom: 12, padding: 16 }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 10,
                  }}
                >
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background:
                        a.type === "essay"
                          ? "var(--accent-soft)"
                          : "var(--primary-soft)",
                      color:
                        a.type === "essay"
                          ? "var(--accent-dark)"
                          : "var(--primary-dark)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      fontSize: 12,
                      flexShrink: 0,
                    }}
                  >
                    {idx + 1}
                  </span>
                  <span className="t-tag">
                    {a.type === "essay" ? <IconPenTool size={12} /> : <IconClipboard size={12} />}
                    {a.type === "essay" ? "Essay" : "PG"} · {a.points}p
                  </span>
                  {a.type === "multiple_choice" && mcCorrect !== null && (
                    <span
                      className={`t-tag ${
                        mcCorrect ? "success" : "danger"
                      }`}
                      style={{ marginLeft: "auto" }}
                    >
                      {mcCorrect ? <IconCheck size={12} /> : <IconX size={12} />}
                      {mcCorrect ? "Benar" : "Salah"} · {a.points}p
                    </span>
                  )}
                </div>

                <div style={{ fontWeight: 600, marginBottom: 10 }}>
                  {a.prompt}
                </div>

                {a.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.image_url}
                    alt="Gambar soal"
                    style={{
                      width: "100%",
                      maxHeight: 260,
                      objectFit: "contain",
                      borderRadius: "var(--radius)",
                      border: "1px solid var(--border-soft)",
                      background: "#fff",
                      display: "block",
                      marginBottom: 12,
                    }}
                  />
                )}

                {a.type === "multiple_choice" && a.options && (
                  <div>
                    {/* Colour-coding the options alone left the parent to infer
                        what the child actually picked, and an unanswered
                        question looked identical to a wrong one. State it. */}
                    {(() => {
                      const got = (() => {
                        try {
                          return JSON.parse(a.response || "[]") as number[];
                        } catch {
                          return [];
                        }
                      })();
                      const picked = got
                        .filter((i) => i >= 0 && i < a.options!.length)
                        .map((i) => String.fromCharCode(65 + i))
                        .join(", ");
                      return (
                        <>
                          <div
                            className="t-soft"
                            style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}
                          >
                            JAWABAN ANAK
                          </div>
                          <div
                            style={{
                              background: got.length ? "var(--card-tint)" : "var(--danger-soft)",
                              color: got.length ? "var(--text)" : "var(--danger-ink)",
                              padding: "8px 10px",
                              borderRadius: "var(--radius-sm)",
                              fontSize: 13,
                              fontWeight: got.length ? 600 : 500,
                              marginBottom: 10,
                            }}
                          >
                            {got.length ? picked : "Tidak menjawab"}
                          </div>
                          <div
                            className="t-soft"
                            style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}
                          >
                            PILIHAN
                          </div>
                        </>
                      );
                    })()}
                    <div style={{ marginBottom: 4 }}>
                      {a.options.map((opt, i) => {
                        const got = (() => {
                          try {
                            return JSON.parse(a.response || "[]") as number[];
                          } catch {
                            return [];
                          }
                        })();
                        const isGot = got.includes(i);
                        const isCorrectAns = a.correct_answer?.includes(i);
                        // Was `var(--success-bg)` / `var(--danger-bg)` — neither
                        // token has ever existed in globals.css, so both resolved
                        // to transparent and the correct/wrong colour coding on
                        // the options never actually painted. These are the real
                        // surface + ink pairs from the v4 token set.
                        const color = isCorrectAns
                          ? "var(--success-soft)"
                          : isGot
                          ? "var(--danger-soft)"
                          : "var(--card-soft)";
                        const textColor = isCorrectAns
                          ? "var(--success-ink)"
                          : isGot
                          ? "var(--danger-ink)"
                          : "var(--text-soft)";
                        return (
                          <div
                            key={i}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              padding: "8px 10px",
                              borderRadius: "var(--radius-sm)",
                              background: color,
                              color: textColor,
                              marginBottom: 4,
                              fontSize: 13,
                            }}
                          >
                            <span
                              style={{ fontWeight: 700, fontSize: 11 }}
                            >
                              {String.fromCharCode(65 + i)}
                            </span>
                            <span style={{ flex: 1 }}>{opt}</span>
                            {isCorrectAns && (
                              <span style={{ color: "var(--success-ink)", display: "flex" }}>
                                <IconCheck size={15} />
                              </span>
                            )}
                            {isGot && !isCorrectAns && (
                              <span style={{ color: "var(--danger-ink)", display: "flex" }}>
                                <IconX size={15} />
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {a.type === "essay" && (
                  <div>
                    <div
                      className="t-soft"
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        marginBottom: 4,
                      }}
                    >
                      JAWABAN ANAK:
                    </div>
                    <div
                      style={{
                        background: "var(--bg-soft)",
                        padding: 12,
                        borderRadius: "var(--radius-sm)",
                        fontSize: 13,
                        lineHeight: 1.6,
                        marginBottom: 12,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {a.response || "(kosong)"}
                    </div>

                    <div
                      className="t-soft"
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        marginBottom: 4,
                      }}
                    >
                      AUTO-GRADE SUGGESTION:
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        marginBottom: 12,
                        color: "var(--text-soft)",
                      }}
                    >
                      Skor auto:{" "}
                      <strong>{a.auto_score ?? 0}</strong> / {a.points}p
                      {a.keywords && a.keywords.length > 0 && (
                        <div
                          style={{
                            marginTop: 6,
                            fontSize: 12,
                            padding: 8,
                            background: "var(--card-soft)",
                            borderRadius: "var(--radius-sm)",
                          }}
                        >
                          <strong>Keywords:</strong>{" "}
                          {a.keywords.map((kw, i) => (
                            <span
                              key={i}
                              style={{
                                display: "inline-block",
                                margin: "2px 4px",
                                padding: "2px 6px",
                                background: "var(--bg-soft)",
                                borderRadius: 6,
                                fontSize: 11,
                              }}
                            >
                              {kw}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="form-group">
                      <label
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          marginBottom: 4,
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span>Override skor</span>
                        <span
                          style={{
                            color: "var(--primary-dark)",
                            fontWeight: 700,
                          }}
                        >
                          {finalScore}/{a.points}p
                        </span>
                      </label>
                      <input
                        id={`score-${a.id}`}
                        aria-label={`Nilai soal ${idx + 1}, maksimal ${a.points} poin`}
                        type="range"
                        min={0}
                        max={a.points}
                        value={finalScore}
                        onChange={(e) =>
                          setEssayScores({
                            ...essayScores,
                            [a.id]: parseInt(e.target.value),
                          })
                        }
                        style={{ width: "100%" }}
                      />
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 11,
                          color: "var(--text-muted)",
                          marginTop: 4,
                        }}
                      >
                        <span>0</span>
                        <span>{a.points}</span>
                      </div>
                    </div>

                    <div className="form-group">
                      <label
                        htmlFor={`comment-${a.id}`}
                        style={{ fontSize: 12, fontWeight: 600 }}
                      >
                        Komentar (opsional)
                      </label>
                      <textarea
                        id={`comment-${a.id}`}
                        className="form-control"
                        placeholder="Misal: Bagus! Jawaban kamu..."
                        value={comment}
                        onChange={(e) =>
                          setComments({
                            ...comments,
                            [a.id]: e.target.value,
                          })
                        }
                        rows={2}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => saveReview(a.id)}
                      disabled={saving}
                      className="btn btn-primary btn-sm"
                      style={{ width: "auto" }}
                    >
                      {saving ? "Menyimpan..." : "Simpan Review"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          <div style={{ textAlign: "center", marginTop: 24 }}>
            <Link
              href={`/quiz/${quiz.id}/share`}
              className="btn btn-outline"
              style={{ maxWidth: 240, margin: "0 auto" }}
            >
              Kirim Hasil ke Anak
            </Link>
          </div>
        </main>
      </div>
    </>
  );
}

"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import { useToast } from "@/components/Toast";
import { LogoMark } from "@/components/LogoMark";

type QuestionData = {
  questionId: string;
  type: "multiple_choice" | "essay";
  prompt: string;
  options?: string[];
  points: number;
  /** Optional figure. Same-origin path under /uploads/questions/. */
  imageUrl?: string | null;
  /** Whether more than one option is correct. Tells the child which mode they
   *  are in without revealing which option — see /api/play/fetch. */
  multiAnswer?: boolean;
};

type AttemptData = {
  quizTitle: string;
  total: number;
  attemptId: string;
};

export default function PlayDoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // The quiz uuid lives in the PATH (`/play/<uuid>/do`), not the query string.
  // This used to be read as `searchParams.get("uuid")`, which is always null
  // here, so `uuid` was "" and every navigation built `/play//do?...` or
  // `/play//done?...` — a 404 the moment a kid tapped "Lanjut", and again on
  // the final submit. `useParams()` is the client-side equivalent of the
  // `params` prop the server components get.
  const params = useParams<{ uuid: string }>();
  const uuid = params?.uuid ?? "";
  const { showToast } = useToast();
  const attemptId = searchParams.get("attempt") ?? "";
  const qNum = parseInt(searchParams.get("q") ?? "1");

  const [data, setData] = useState<AttemptData | null>(null);
  const [question, setQuestion] = useState<QuestionData | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [essay, setEssay] = useState("");
  const [submitting, startSubmit] = useTransition();
  const [saving, startSave] = useTransition();

  useEffect(() => {
    if (!attemptId) return;
    let cancelled = false;
    async function load() {
      const res = await fetch(`/api/play/fetch?attempt=${attemptId}&q=${qNum}`);
      if (cancelled) return;
      if (!res.ok) {
        showToast("Gagal memuat soal", "error");
        return;
      }
      const json = await res.json();
      if (json.done) {
        startSubmit(async () => {
          const r = await fetch("/api/play/submit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ attemptId }),
          });
          if (r.ok) {
            router.push(`/play/${uuid}/done?attempt=${attemptId}`);
          }
        });
        return;
      }
      setData(json.attempt);
      setQuestion(json.question);
      setSelected(new Set());
      setEssay("");
      if (json.previousAnswer) {
        if (json.question.type === "multiple_choice") {
          try {
            const idx = JSON.parse(json.previousAnswer) as number[];
            setSelected(new Set(idx));
          } catch {
            /* ignore */
          }
        } else {
          setEssay(json.previousAnswer);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId, qNum]);

  if (!attemptId) {
    return (
      <main style={{ padding: 40, textAlign: "center", color: "var(--text)" }}>
        <p>Sesi tidak valid. Silakan mulai ulang dari halaman kuis.</p>
      </main>
    );
  }

  if (!question || !data) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg)",
        }}
      >
        <div className="brand-logo">
          <LogoMark />
        </div>
      </main>
    );
  }

  const totalQuestions = data.total;
  const progressPct = ((qNum - 1) / totalQuestions) * 100;

  async function saveAndNext() {
    if (!question) return;
    startSave(async () => {
      const saveRes = await fetch("/api/play/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId,
          questionId: question.questionId,
          type: question.type,
          ...(question.type === "multiple_choice"
            ? { selectedIndices: Array.from(selected).sort() }
            : { text: essay }),
        }),
      });
      if (!saveRes.ok) {
        showToast("Gagal menyimpan jawaban", "error");
        return;
      }
      const nextQ = qNum + 1;
      if (nextQ > totalQuestions) {
        startSubmit(async () => {
          const r = await fetch("/api/play/submit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ attemptId }),
          });
          if (r.ok) {
            router.push(`/play/${uuid}/done?attempt=${attemptId}`);
          }
        });
      } else {
        router.push(`/play/${uuid}/do?attempt=${attemptId}&q=${nextQ}`);
      }
    });
  }

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
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
        }}
      >
        <header
          style={{
            padding: "12px 16px",
            background: "rgba(255,255,255,0.1)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 13,
            fontWeight: 600,
            color: "#fff",
          }}
        >
          <span>
            Soal {qNum}/{totalQuestions}
          </span>
          <span>EaLearn</span>
        </header>

        <div
          style={{
            height: 4,
            background: "rgba(255,255,255,0.18)",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progressPct + 100 / totalQuestions}%`,
              background: "#fff",
              transition: "width 0.3s ease",
            }}
          />
        </div>

        <main
          className="animate-fade-in"
          style={{
            flex: 1,
            padding: "24px 16px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              background: "rgba(255,255,255,0.18)",
              padding: "4px 10px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              alignSelf: "flex-start",
              marginBottom: 12,
              backdropFilter: "blur(8px)",
            }}
          >
            {question.type === "multiple_choice" ? "PILIHAN GANDA" : "ESSAY"} ·{" "}
            {question.points} POIN
          </div>

          {/* The options below are multi-select, but the badge above says
              "PILIHAN GANDA", which in Indonesian school usage means one
              answer. A child who taps a second option gets zero — grading
              requires an exact match — and nothing on screen explains it. So
              the mode is stated, in words, right above the options. */}
          {question.type === "multiple_choice" && (
            <p
              style={{
                fontSize: 13,
                opacity: 0.9,
                marginTop: -4,
                marginBottom: 14,
                fontWeight: 600,
              }}
            >
              {question.multiAnswer
                ? "Pilih semua jawaban yang benar."
                : "Pilih satu jawaban yang benar."}
            </p>
          )}

          <h2
            style={{
              fontSize: 20,
              fontWeight: 700,
              lineHeight: 1.4,
              marginBottom: 24,
            }}
          >
            {question.prompt}
          </h2>

          {/* Above the options, below the prompt: the child reads the question,
              looks at the figure, then answers. White plate behind it so a dark
              or transparent PNG is still legible on the coloured background. */}
          {question.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={question.imageUrl}
              alt="Gambar soal"
              style={{
                width: "100%",
                maxHeight: 260,
                objectFit: "contain",
                borderRadius: "var(--radius)",
                background: "#fff",
                display: "block",
                marginBottom: 20,
              }}
            />
          )}

          {question.type === "multiple_choice" ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {question.options?.map((opt, i) => {
                const isSelected = selected.has(i);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      const newSet = new Set(selected);
                      if (newSet.has(i)) newSet.delete(i);
                      else newSet.add(i);
                      setSelected(newSet);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "14px 16px",
                      borderRadius: "var(--radius)",
                      background: isSelected
                        ? "rgba(255,255,255,0.95)"
                        : "rgba(255,255,255,0.1)",
                      color: isSelected ? "var(--text)" : "#fff",
                      border: isSelected
                        ? "2px solid #fff"
                        : "2px solid rgba(255,255,255,0.2)",
                      cursor: "pointer",
                      textAlign: "left",
                      fontWeight: 500,
                      fontSize: 14,
                    }}
                  >
                    <span
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: isSelected
                          ? "var(--primary)"
                          : "rgba(255,255,255,0.2)",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        fontSize: 13,
                      }}
                    >
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span style={{ flex: 1 }}>{opt || `Opsi ${i + 1}`}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <textarea
              className="form-control"
              rows={6}
              placeholder="Tulis jawaban kamu di sini..."
              value={essay}
              onChange={(e) => setEssay(e.target.value)}
              maxLength={1000}
              style={{
                flex: 1,
                minHeight: 160,
                fontSize: 15,
                background: "rgba(255,255,255,0.95)",
                color: "var(--text)",
                border: "2px solid transparent",
                lineHeight: 1.6,
              }}
            />
          )}

          <div style={{ marginTop: "auto", paddingTop: 24 }}>
            <button
              type="button"
              onClick={saveAndNext}
              disabled={
                saving ||
                submitting ||
                (question.type === "multiple_choice" && selected.size === 0) ||
                (question.type === "essay" && essay.trim().length === 0)
              }
              className="btn btn-accent"
              style={{ fontWeight: 700 }}
            >
              {saving && <span className="btn-spinner" aria-hidden="true" />}
              {submitting
                ? "Mengirim..."
                : qNum === totalQuestions
                ? "Submit"
                : "Lanjut →"}
            </button>
          </div>
        </main>
      </div>
    </>
  );
}


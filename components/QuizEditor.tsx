"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import {
  IconPlus,
  IconX,
  IconCheck,
  IconArrowLeft,
  IconClipboard,
  IconPenTool,
} from "@/components/Icon";
import { QuestionImageField } from "@/components/QuestionImageField";

export type QuizQuestion = {
  id: string;
  type: "multiple_choice" | "essay";
  prompt: string;
  options?: string[];
  correctAnswer?: number[];
  keywords?: string[];
  keywordWeights?: number[];
  /** Optional figure, e.g. "/uploads/questions/x.png". */
  imageUrl?: string | null;
  points: number;
  orderIndex: number;
};

export type QuizForEdit = {
  id: string;
  title: string;
  description: string | null;
  subject: string | null;
  ageRange: string;
  status: string;
  shareUuid: string;
};

export function QuizEditor({
  quiz,
  initialQuestions,
}: {
  quiz: QuizForEdit;
  initialQuestions: QuizQuestion[];
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [title, setTitle] = useState(quiz.title);
  const [description, setDescription] = useState(quiz.description ?? "");
  const [subject, setSubject] = useState(quiz.subject ?? "");
  const [ageRange, setAgeRange] = useState(quiz.ageRange);
  const [questions, setQuestions] = useState<QuizQuestion[]>(initialQuestions);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPublishing, startPublish] = useTransition();
  const [isPending, startTransition] = useTransition();

  const isDraft = quiz.status === "draft";
  const totalPoints = questions.reduce((s, q) => s + q.points, 0);

  /* Declared before the effect that calls it. Function declarations are
     hoisted so this used to run fine, but relying on that hides the fact that
     the auto-save effect depends on a value that did not exist yet at the
     point of use — move it up so the dependency is plain to read. */
  async function saveMeta() {
    try {
      await fetch(`/api/quiz/${quiz.id}/update`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || null,
          subject: subject || null,
          ageRange,
        }),
      });
    } catch {
      // Silent — auto-save retries next time
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      if (
        title !== quiz.title ||
        description !== (quiz.description ?? "") ||
        subject !== (quiz.subject ?? "") ||
        ageRange !== quiz.ageRange
      ) {
        saveMeta();
      }
    }, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, subject, ageRange]);

  async function addQuestion(type: "multiple_choice" | "essay") {
    const body =
      type === "multiple_choice"
        ? {
            type: "multiple_choice",
            prompt: "",
            options: ["", ""],
            correctAnswer: [0],
            points: 10,
          }
        : {
            type: "essay",
            prompt: "",
            keywords: [""],
            keywordWeights: [1],
            points: 20,
          };
    const res = await fetch(`/api/quiz/${quiz.id}/question`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.question) {
      setQuestions([...questions, data.question]);
      setEditingId(data.question.id);
      showToast("Soal ditambahkan", "success");
    } else {
      showToast(data.error || "Gagal", "error");
    }
  }

  async function updateQuestion(updated: QuizQuestion) {
    setQuestions(questions.map((q) => (q.id === updated.id ? updated : q)));
    const body: Record<string, unknown> = {
      prompt: updated.prompt,
      points: updated.points,
      // This body is assembled field by field rather than spread from
      // `updated`, so every field has to be listed here or it silently never
      // reaches the server. imageUrl was missing from that list: the upload
      // succeeded, the editor showed a preview and said "Gambar ditambahkan",
      // and image_url stayed NULL in the database — so the child opened the
      // published quiz and saw a question with nothing to look at.
      //
      // `?? null` rather than `|| null` only for readability — mapQuestion
      // always produces string | null, so both are equivalent. null is the
      // value that clears the column, which is what clicking "Hapus" must do.
      imageUrl: updated.imageUrl ?? null,
    };
    if (updated.type === "multiple_choice") {
      body.type = "multiple_choice";
      body.options = updated.options;
      body.correctAnswer = updated.correctAnswer;
    } else {
      body.type = "essay";
      body.keywords = updated.keywords;
      body.keywordWeights = updated.keywordWeights;
    }
    await fetch(`/api/quiz/${quiz.id}/question/${updated.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async function deleteQuestion(qid: string) {
    if (!confirm("Hapus soal ini?")) return;
    await fetch(`/api/quiz/${quiz.id}/question/${qid}`, {
      method: "DELETE",
    });
    setQuestions(questions.filter((q) => q.id !== qid));
    showToast("Soal dihapus", "info");
  }

  async function togglePublish() {
    startPublish(async () => {
      const res = await fetch(`/api/quiz/${quiz.id}/publish`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        showToast(
          data.status === "ready"
            ? "Kuis dipublikasikan!"
            : "Kuis di-unpublish",
          "success",
        );
        router.refresh();
      } else {
        showToast(data.error || "Gagal", "error");
      }
    });
  }

  async function deleteQuiz() {
    if (!confirm("Hapus kuis ini permanen? Semua hasil ikut terhapus.")) return;
    startTransition(async () => {
      const res = await fetch(`/api/quiz/${quiz.id}/delete`, {
        method: "DELETE",
      });
      if (res.ok) {
        showToast("Kuis dihapus", "info");
        router.push("/dashboard");
      }
    });
  }

  return (
    <>
      <div className="bg-aurora bg-aurora-quiz" aria-hidden="true" />
      <div
        className="shell-mobile-full"
        style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}
      >
        <header className="page-header">
          {/* aria-label was missing here while every other .back link in the app has
            one. The element only contains an <svg>, so a screen reader
            announced it as an unlabelled link. */}
          <Link
            href={`/quiz/${quiz.id}`}
            className="back"
            aria-label="Kembali ke detail kuis"
          >
            <IconArrowLeft size={20} />
          </Link>
          <h1 style={{ fontSize: 14 }}>Edit Kuis</h1>
          <button
            onClick={togglePublish}
            disabled={isPublishing || questions.length === 0}
            className="btn btn-primary btn-sm"
            style={{ width: "auto", padding: "8px 14px", fontSize: 12 }}
          >
            {isPublishing
              ? "..."
              : isDraft
              ? "Publish"
              : "Unpublish"}
          </button>
        </header>

        <main
          className="animate-fade-in"
          style={{ flex: 1, padding: "16px", paddingBottom: 80 }}
        >
          <div className="card" style={{ padding: 16, marginBottom: 16 }}>
            <div className="form-group">
              <label htmlFor="title">Judul</label>
              <input
                id="title"
                type="text"
                className="form-control"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="desc">Deskripsi (opsional)</label>
              <textarea
                id="desc"
                className="form-control"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div className="form-group">
                <label htmlFor="subject">Mapel</label>
                {/* Was a <select> of seven fixed options, ending in
                    "Lainnya" — which stored the literal string "Lainnya" and
                    threw away whatever the parent actually meant. Free text
                    now, matching /quiz/new. */}
                <input
                  id="subject"
                  type="text"
                  className="form-control"
                  placeholder="Misalnya: Matematika"
                  value={subject}
                  maxLength={50}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="ageRange">Usia</label>
                {/* Was "5-8 tahun" / "9-12 tahun" / "13-17 tahun". The stored
                    value is exactly the child's own answer, with no " tahun"
                    suffix bolted on, because the pages that display it
                    ({quiz.ageRange} tahun) add the unit themselves. */}
                <input
                  id="ageRange"
                  type="text"
                  className="form-control"
                  placeholder="Misalnya: 9-12"
                  value={ageRange}
                  maxLength={30}
                  onChange={(e) => setAgeRange(e.target.value)}
                />
              </div>
            </div>
            <div
              className="t-soft"
              style={{
                display: "flex",
                justifyContent: "space-between",
                borderTop: "1px solid var(--border-soft)",
                paddingTop: 8,
              }}
            >
              <span>Total: {questions.length} soal · {totalPoints} poin</span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {isDraft ? <IconClipboard size={14} /> : <IconCheck size={14} />}
                {isDraft ? "Draft" : "Published"}
              </span>
            </div>
          </div>

          <h3 className="h-section" style={{ marginBottom: 12 }}>
            Soal ({questions.length})
          </h3>

          {questions.length === 0 && (
            <div className="empty-state">
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: "var(--bg-soft)",
                  color: "var(--primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 28,
                }}
              >
                <IconClipboard size={28} />
              </div>
              <h2 className="h-title" style={{ fontSize: 18, margin: "12px 0 6px" }}>
                Belum ada soal
              </h2>
              <p className="t-muted" style={{ fontSize: 13, marginBottom: 16 }}>
                Tambah soal pertama untuk mulai
              </p>
            </div>
          )}

          {questions.map((q, i) => (
            <QuestionEditor
              key={q.id}
              question={q}
              index={i}
              isEditing={editingId === q.id}
              onEdit={() => setEditingId(q.id)}
              onClose={() => setEditingId(null)}
              onChange={(updated) => updateQuestion(updated)}
              onDelete={() => deleteQuestion(q.id)}
            />
          ))}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              marginTop: 16,
            }}
          >
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => addQuestion("multiple_choice")}
            >
              <IconPlus size={16} /> Soal PG
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => addQuestion("essay")}
            >
              <IconPlus size={16} /> Soal Essay
            </button>
          </div>

          <div
            style={{
              marginTop: 32,
              paddingTop: 16,
              borderTop: "1px solid var(--border-soft)",
              textAlign: "center",
            }}
          >
            <button
              type="button"
              onClick={deleteQuiz}
              disabled={isPending}
              className="btn btn-ghost btn-sm"
              style={{
                color: "var(--danger)",
                width: "auto",
                padding: "8px 16px",
              }}
            >
              Hapus Kuis Permanen
            </button>
          </div>
        </main>
      </div>
    </>
  );
}

function QuestionEditor({
  question,
  index,
  isEditing,
  onEdit,
  onClose,
  onChange,
  onDelete,
}: {
  question: QuizQuestion;
  index: number;
  isEditing: boolean;
  onEdit: () => void;
  onClose: () => void;
  onChange: (q: QuizQuestion) => void;
  onDelete: () => void;
}) {
  const [local, setLocal] = useState(question);

  if (!isEditing) {
    return (
      <div
        className="card card-clickable"
        style={{
          marginBottom: 8,
          padding: 12,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
        onClick={onEdit}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background:
              question.type === "essay"
                ? "var(--accent-soft)"
                : "var(--primary-soft)",
            color:
              question.type === "essay"
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
          {index + 1}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: 13,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {question.prompt || "(kosong)"}
          </div>
          <div
            className="t-soft"
            style={{ marginTop: 2, display: "inline-flex", alignItems: "center", gap: 5 }}
          >
            {question.type === "essay" ? <IconPenTool size={13} /> : <IconClipboard size={13} />}
            {question.type === "essay" ? "Essay" : "Pilihan ganda"} · {question.points} poin
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="card"
      style={{
        marginBottom: 12,
        padding: 16,
        background: "var(--card-soft)",
        border: "2px solid var(--primary)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <span className="t-tag primary">
          Soal {index + 1} · {question.points}p
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            onClick={onClose}
            className="btn-icon"
            title="Tutup"
            style={{ width: 32, height: 32, padding: 0 }}
          >
            <IconCheck size={14} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="btn-icon"
            title="Hapus"
            style={{
              width: 32,
              height: 32,
              padding: 0,
              background: "var(--danger-soft)",
              color: "var(--danger)",
            }}
          >
            <IconX size={14} />
          </button>
        </div>
      </div>

      <textarea
        className="form-control"
        rows={2}
        placeholder="Tulis pertanyaan..."
        value={local.prompt}
        onChange={(e) => setLocal({ ...local, prompt: e.target.value })}
        onBlur={() => onChange(local)}
        style={{ marginBottom: 12 }}
      />

      {/* Outside the type branch on purpose: a figure is just as necessary for
          an essay about a diagram as for a multiple-choice geometry question. */}
      <QuestionImageField
        value={local.imageUrl}
        onChange={(url) => {
          const updated = { ...local, imageUrl: url };
          setLocal(updated);
          onChange(updated);
        }}
      />

      {question.type === "multiple_choice" ? (
        <div>
          {/* One correct answer per question.

              This was a checkbox, which said "include or exclude this option"
              and allowed two to be ticked at once. For "pilihan ganda" that is
              both the wrong control and a trap: tick A and C by accident and
              the child cannot score, because grading (lib/grading.ts) requires
              the answer to match the key exactly.

              The key is still stored as a JSON array, and grading still
              compares arrays — only the authoring control is now single-select,
              so a question can never be saved in the state that is unwinnable.
              Every existing question in the database already had exactly one
              correct answer, so nothing was representable before that is not
              now. */}
          <p
            className="t-soft"
            style={{ fontSize: 11, marginBottom: 8, display: "flex", gap: 6, alignItems: "center" }}
          >
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                border: "1.5px solid var(--border)",
                display: "inline-block",
                flexShrink: 0,
              }}
              aria-hidden="true"
            />
            Pilih satu jawaban yang benar
          </p>
          {local.options?.map((opt, i) => {
            const isCorrect = (local.correctAnswer ?? [])[0] === i;
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 6,
                }}
              >
                <input
                  type="radio"
                  name={`correct-${question.id}`}
                  checked={isCorrect}
                  onChange={() => {
                    const updated = { ...local, correctAnswer: [i] };
                    setLocal(updated);
                    onChange(updated);
                  }}
                  style={{ width: 18, height: 18, flexShrink: 0, cursor: "pointer" }}
                  aria-label={`Opsi ${String.fromCharCode(65 + i)} sebagai jawaban benar`}
                />
                <input
                  type="text"
                  className="form-control"
                  placeholder={`Opsi ${String.fromCharCode(65 + i)}`}
                  value={opt}
                  aria-label={`Teks opsi ${String.fromCharCode(65 + i)}`}
                  onChange={(e) => {
                    const newOpts = [...(local.options ?? [])];
                    newOpts[i] = e.target.value;
                    setLocal({ ...local, options: newOpts });
                  }}
                  onBlur={() => onChange(local)}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    // The correct option is called out by the text field itself,
                    // so the answer key is readable at a glance and not only
                    // from an 18px dot.
                    ...(isCorrect
                      ? {
                          borderColor: "var(--primary)",
                          background: "var(--primary-soft)",
                        }
                      : {}),
                  }}
                />
                {local.options && local.options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => {
                      const updated = {
                        ...local,
                        options: local.options!.filter((_, idx) => idx !== i),
                        correctAnswer: (local.correctAnswer ?? [])
                          .filter((x) => x !== i)
                          .map((x) => (x > i ? x - 1 : x)),
                      };
                      setLocal(updated);
                      onChange(updated);
                    }}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                      padding: 4,
                    }}
                    title="Hapus opsi"
                  >
                    <IconX size={14} />
                  </button>
                )}
              </div>
            );
          })}
          {local.options && local.options.length < 6 && (
            <button
              type="button"
              onClick={() => {
                const updated = {
                  ...local,
                  options: [...(local.options ?? []), ""],
                };
                setLocal(updated);
                onChange(updated);
              }}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--primary)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                padding: "8px 0",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <IconPlus size={12} /> Tambah opsi (max 6)
            </button>
          )}
        </div>
      ) : (
        <div>
          <div
            className="t-soft"
            style={{ marginBottom: 8, fontSize: 12, fontWeight: 600 }}
          >
            Keyword (dengan bobot)
          </div>
          {local.keywords?.map((kw, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 6,
              }}
            >
              <input
                type="text"
                className="form-control"
                placeholder={`Keyword ${i + 1}`}
                value={kw}
                onChange={(e) => {
                  const newKws = [...(local.keywords ?? [])];
                  newKws[i] = e.target.value;
                  setLocal({ ...local, keywords: newKws });
                }}
                onBlur={() => onChange(local)}
                style={{ flex: 1, padding: "8px 12px" }}
              />
              <select
                className="form-control"
                value={local.keywordWeights?.[i] ?? 1}
                onChange={(e) => {
                  const newWeights = [...(local.keywordWeights ?? [])];
                  newWeights[i] = parseInt(e.target.value);
                  setLocal({ ...local, keywordWeights: newWeights });
                }}
                onBlur={() => onChange(local)}
                style={{ width: 70, padding: "8px" }}
              >
                <option value="1">+1</option>
                <option value="2">+2</option>
                <option value="3">+3</option>
                <option value="4">+4</option>
                <option value="5">+5</option>
              </select>
              {local.keywords && local.keywords.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const updated = {
                      ...local,
                      keywords: local.keywords!.filter((_, idx) => idx !== i),
                      keywordWeights: (local.keywordWeights ?? []).filter(
                        (_, idx) => idx !== i,
                      ),
                    };
                    setLocal(updated);
                    onChange(updated);
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    padding: 4,
                  }}
                >
                  <IconX size={14} />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              const updated = {
                ...local,
                keywords: [...(local.keywords ?? []), ""],
                keywordWeights: [...(local.keywordWeights ?? []), 1],
              };
              setLocal(updated);
              onChange(updated);
            }}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--primary)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              padding: "8px 0",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <IconPlus size={12} /> Tambah keyword (max 10)
          </button>
        </div>
      )}

      <div
        style={{
          marginTop: 12,
          paddingTop: 12,
          borderTop: "1px solid var(--border-soft)",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <label
          style={{
            fontSize: 12,
            color: "var(--text-soft)",
            fontWeight: 600,
          }}
        >
          Poin:
        </label>
        <input
          type="number"
          min={1}
          max={100}
          className="form-control"
          value={local.points}
          onChange={(e) =>
            setLocal({
              ...local,
              points: Math.max(1, parseInt(e.target.value) || 10),
            })
          }
          onBlur={() => onChange(local)}
          style={{ width: 80, padding: "6px 10px" }}
        />
        <button
          type="button"
          onClick={onClose}
          className="btn btn-primary btn-sm"
          style={{ width: "auto", marginLeft: "auto" }}
        >
          Selesai
        </button>
      </div>
    </div>
  );
}

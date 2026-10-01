"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { IconLightbulb } from "@/components/Icon";

/**
 * No subject presets and no age presets.
 *
 * Both used to be fixed choices — three big buttons for the subject, three for
 * the age range — with `AgeRange` typed as `"5-8" | "9-12" | "13-17"` and a
 * matching z.enum on the API. The parent types both now.
 *
 * A three-item scale is the wrong shape for this: it has no room for "TK B",
 * "kelas 4", or "8-9", and a worksheet is being made for one specific child,
 * not for a cohort. The age column was always plain TEXT with no CHECK
 * constraint, so nothing stored before is invalidated.
 */
const SUBJECT_HINT = "Misalnya: Matematika, IPA, Bahasa Indonesia…";
const AGE_HINT = "Misalnya: 9-12 tahun, kelas 4, TK B";

/**
 * The form half of /quiz/new.
 *
 * This used to be rendered inline from a Server Component: no "use client",
 * no useState, no onChange on the inputs, no onClick on the subject/age
 * pills, and the primary "Lanjut ke Editor Soal" button had no handler at
 * all. The page looked complete and did nothing — you could not even keep a
 * typed title, and no quiz could ever be created from the browser. The
 * subject/age selection was hardcoded to "i === 0" / "i === 1" so it only
 * ever *looked* like something was selected.
 *
 * The server page keeps the auth redirect and hands the body to this.
 */
export function NewQuizForm() {
  const router = useRouter();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  // Both start empty: the point of the change is that the parent types these,
  // so pre-filling "Matematika" / "9-12" would leave a form that looks filled
  // in without the parent ever having said so.
  const [subject, setSubject] = useState<string>("");
  const [ageRange, setAgeRange] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [ageError, setAgeError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (trimmed.length < 1) {
      setError("Judul kuis wajib diisi.");
      showToast("Judul kuis wajib diisi", "error");
      return;
    }
    if (trimmed.length > 100) {
      setError("Judul maksimal 100 karakter.");
      showToast("Judul maksimal 100 karakter", "error");
      return;
    }
    setError(null);

    // Required: age_range is NOT NULL in the schema, and a quiz with no target
    // age is not a usable worksheet. The subject column is nullable, so an
    // empty one is allowed — a parent making a maths sheet may not think of it
    // as a subject at all.
    if (!ageRange.trim()) {
      setAgeError("Isi usia target anak, misalnya 9-12 tahun.");
      showToast("Usia target anak wajib diisi", "error");
      return;
    }
    setAgeError(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/quiz/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: trimmed,
            description: description.trim() || undefined,
            subject: subject.trim() || undefined,
            ageRange: ageRange.trim(),
          }),
        });
        const data = await res.json();
        if (!res.ok || !data?.id) {
          const msg = data?.error || "Gagal membuat kuis";
          setError(msg);
          showToast(msg, "error");
          return;
        }
        showToast("Kuis dibuat. Lanjut tambah soal.", "success");
        router.push(`/quiz/${data.id}/edit`);
      } catch {
        const msg = "Koneksi gagal, coba lagi";
        setError(msg);
        showToast(msg, "error");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="form-group">
        <label htmlFor="title">
          Judul kuis <span style={{ color: "var(--danger-ink)" }}>*</span>
        </label>
        <input
          id="title"
          type="text"
          className="form-control"
          placeholder="Misalnya: Latihan Pecahan"
          value={title}
          maxLength={100}
          aria-invalid={!!error}
          aria-describedby={error ? "title-error" : undefined}
          onChange={(e) => {
            setTitle(e.target.value);
            if (error) setError(null);
          }}
        />
      </div>

      <div className="form-group">
        <label htmlFor="desc">Deskripsi (opsional)</label>
        <textarea
          id="desc"
          className="form-control"
          placeholder="Catatan untuk anak atau dirimu sendiri..."
          rows={3}
          maxLength={500}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      {error && (
        <p
          id="title-error"
          className="input-error"
          role="alert"
          style={{ marginTop: -8, marginBottom: 16 }}
        >
          {error}
        </p>
      )}

      <div className="form-group">
        <label htmlFor="subject">Mata pelajaran</label>
        <input
          id="subject"
          type="text"
          className="form-control"
          placeholder={SUBJECT_HINT}
          value={subject}
          maxLength={50}
          onChange={(e) => setSubject(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label htmlFor="ageRange">
          Usia target anak{" "}
          <span style={{ color: "var(--danger-ink)" }}>*</span>
        </label>
        <input
          id="ageRange"
          type="text"
          className="form-control"
          placeholder={AGE_HINT}
          value={ageRange}
          maxLength={30}
          aria-invalid={!!ageError}
          aria-describedby={ageError ? "age-error" : undefined}
          onChange={(e) => {
            setAgeRange(e.target.value);
            if (ageError) setAgeError(null);
          }}
        />
        {ageError && (
          <p
            id="age-error"
            className="input-error"
            role="alert"
            style={{ marginTop: -8, marginBottom: 16 }}
          >
            {ageError}
          </p>
        )}
      </div>

      <div
        className="card-soft"
        style={{
          margin: "20px 0",
          background:
            "linear-gradient(135deg, var(--primary-soft) 0%, var(--accent-soft) 100%)",
          border: "none",
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <span style={{ color: "var(--accent-ink)", flexShrink: 0, marginTop: 2 }}>
            <IconLightbulb size={20} />
          </span>
          <div className="t-muted" style={{ fontSize: 13 }}>
            <strong style={{ color: "var(--text)" }}>Tips cepat:</strong> Tambah
            soal satu per satu, lalu publish saat sudah siap. Link share-nya
            bisa dibuka anak di HP tanpa install apa pun.
          </div>
        </div>
      </div>

      <button
        type="submit"
        className="btn btn-primary btn-block"
        style={{ marginTop: 12 }}
        disabled={isPending}
      >
        {isPending && (
          <span className="btn-spinner" aria-hidden="true" />
        )}
        {isPending ? "Menyimpan..." : "Lanjut ke Editor Soal"}
        {!isPending && (
          <span style={{ fontSize: 18 }} aria-hidden="true">
            &rarr;
          </span>
        )}
      </button>
    </form>
  );
}

"use client";

/**
 * Optional image for a question — for the questions that cannot be read
 * without a figure: a geometry diagram, a map, a screenshot of a word problem.
 *
 * The file goes to POST /api/upload, which decides the real type from the
 * file's magic bytes and returns a path under /uploads/questions/. This
 * component only ever stores that returned path; it never builds a URL out of
 * the local filename, which is why the schema can safely require a path shape.
 *
 * Plain <img>, not next/image. These are user uploads that are already as
 * large as they will ever be served, so the optimizer would add a config
 * surface and a resize hop without making them smaller, and a mis-sized image
 * in next/image renders as a blank box rather than a broken icon — worse for a
 * child staring at a diagram they cannot see.
 */
import { useRef, useState } from "react";
import { useToast } from "@/components/Toast";
import { IconImage, IconX, IconCheck } from "@/components/Icon";

const MAX_MB = 5;

export function QuestionImageField({
  value,
  onChange,
}: {
  value?: string | null;
  onChange: (url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();

  async function handleFile(file: File) {
    // Check here so a 40 MB photo does not spend bandwidth to be refused
    // server-side. The server checks again — this is convenience, not safety.
    if (file.size > MAX_MB * 1024 * 1024) {
      showToast(`Gambar maksimal ${MAX_MB} MB`, "error");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || "Gagal mengunggah gambar", "error");
        return;
      }
      onChange(data.url);
      showToast("Gambar ditambahkan", "success");
    } catch {
      showToast("Gagal mengunggah gambar", "error");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div style={{ marginBottom: 12 }}>
      {value ? (
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: 8,
            background: "var(--bg-soft)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Pratinjau gambar soal"
            style={{
              width: "100%",
              maxHeight: 220,
              objectFit: "contain",
              borderRadius: 6,
              background: "#fff",
              display: "block",
            }}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 8,
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: 11,
                color: "var(--success-ink, var(--primary-ink))",
                fontWeight: 600,
              }}
            >
              <IconCheck size={13} />
              Gambar terlampir
            </span>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="btn btn-ghost btn-sm"
              style={{
                marginLeft: "auto",
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "4px 8px",
                fontSize: 11,
              }}
            >
              <IconX size={12} />
              Hapus
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          style={{
            width: "100%",
            padding: "14px",
            border: "1.5px dashed var(--border)",
            borderRadius: "var(--radius)",
            background: "var(--bg-soft)",
            color: "var(--text-soft)",
            fontSize: 12,
            fontWeight: 600,
            cursor: busy ? "wait" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <IconImage size={16} />
          {busy ? "Mengunggah..." : "Tambah gambar (opsional)"}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
        style={{ display: "none" }}
        aria-label="Pilih gambar untuk soal"
      />
      <p className="t-soft" style={{ fontSize: 11, marginTop: 6 }}>
        PNG, JPG, GIF, atau WebP · maksimal {MAX_MB} MB
      </p>
    </div>
  );
}

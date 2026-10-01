"use client";

/**
 * Per-quiz CRUD row: Read (detail), Update (edit), Share, Results, Delete.
 *
 * Delete existed only as a "Hapus Kuis Permanen" button buried at the bottom
 * of the editor, so the only way to remove a quiz was to open it first and
 * scroll past every question. This puts the whole set on the card itself.
 *
 * It has to be a client component because delete is a fetch + router.refresh,
 * and it has to sit OUTSIDE the card's <Link> — a <button> inside an <a> is
 * invalid HTML and swallows the click.
 */
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { IconEdit, IconShare, IconChart, IconList, IconX, IconTrash } from "@/components/Icon";

type Action = {
  href: string;
  label: string;
  icon: typeof IconEdit;
  bg: string;
  fg: string;
};

export function QuizActions({
  quizId,
  title,
  attemptCount,
}: {
  quizId: string;
  title: string;
  attemptCount: number;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [deleting, startDelete] = useTransition();

  const actions: Action[] = [
    {
      href: `/quiz/${quizId}`,
      label: "Detail",
      icon: IconList,
      bg: "var(--bg-soft)",
      fg: "var(--text-soft)",
    },
    {
      href: `/quiz/${quizId}/edit`,
      label: "Edit",
      icon: IconEdit,
      bg: "var(--info-soft)",
      fg: "var(--info-ink)",
    },
    {
      href: `/quiz/${quizId}/share`,
      label: "Share",
      icon: IconShare,
      bg: "var(--primary-soft)",
      fg: "var(--primary-ink)",
    },
    {
      href: `/quiz/${quizId}/results`,
      label: "Hasil",
      icon: IconChart,
      bg: "var(--accent-soft)",
      fg: "var(--accent-ink)",
    },
  ];

  function remove() {
    startDelete(async () => {
      const res = await fetch(`/api/quiz/${quizId}/delete`, { method: "DELETE" });
      if (res.ok) {
        showToast(`"${title}" dihapus`, "info");
        setConfirming(false);
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || "Gagal hapus kuis", "error");
        setConfirming(false);
      }
    });
  }

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        alignItems: "center",
        paddingTop: 12,
        marginTop: 12,
        borderTop: "1px solid var(--border-soft)",
      }}
    >
      {actions.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "7px 10px",
            minHeight: 34,
            borderRadius: 8,
            background: a.bg,
            color: a.fg,
            fontSize: 12,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          <a.icon size={13} />
          {a.label}
        </Link>
      ))}

      <div style={{ flex: 1, minWidth: 0 }} />

      {confirming ? (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--danger-ink)" }}>
            Hapus permanen?
          </span>
          {attemptCount > 0 && (
            <span className="t-soft" style={{ fontSize: 11 }}>
              {attemptCount} attempt ikut terhapus
            </span>
          )}
          <button
            type="button"
            onClick={remove}
            disabled={deleting}
            className="btn btn-sm"
            style={{
              background: "var(--danger)",
              color: "#fff",
              padding: "7px 12px",
              minHeight: 34,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {deleting ? "Menghapus..." : "Ya, hapus"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={deleting}
            aria-label="Batal hapus"
            style={{
              padding: "7px 10px",
              minHeight: 34,
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--card)",
              color: "var(--text-soft)",
              fontSize: 12,
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            <IconX size={13} />
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "7px 10px",
            minHeight: 34,
            borderRadius: 8,
            background: "var(--danger-soft)",
            color: "var(--danger-ink)",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          <IconTrash size={13} />
          Hapus
        </button>
      )}
    </div>
  );
}

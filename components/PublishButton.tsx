"use client";

/**
 * Tombol publish/unpublish yang bisa dipakai di mana saja.
 *
 * Dipisah dari editor supaya halaman Bagikan dan halaman Detail Kuis bisa
 * punya aksi yang sama tanpa menyalin logika fetch + toast. Editor tetap
 * memakai versinya sendiri, karena di sana tombolnya sudah jadi bagian dari
 * baris aksi yang lebih besar.
 *
 * Tombol publish sengaja memanggil API yang sama dengan editor, jadi aturan
 * kelengkapan soal hanya ada di satu tempat: /api/quiz/[id]/publish.
 */
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { IconRocket, IconX } from "@/components/Icon";

export function PublishButton({
  quizId,
  status,
  label,
  variant = "primary",
}: {
  quizId: string;
  status: string;
  label?: string;
  variant?: "primary" | "ghost";
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [busy, startTransition] = useTransition();
  const isDraft = status === "draft";

  function toggle() {
    startTransition(async () => {
      const res = await fetch(`/api/quiz/${quizId}/publish`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast(
          data.status === "ready"
            ? "Kuis dipublikasikan! Link bisa dipakai."
            : "Kuis di-unpublish. Link anak tidak bisa dibuka.",
          "success",
        );
        router.refresh();
      } else {
        // Pesan dari server menyebut nomor soal yang belum lengkap, jadi
        // jangan ditimpa dengan teks generik.
        showToast(data.error || "Gagal mengubah status kuis", "error");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className={variant === "primary" ? "btn btn-accent" : "btn btn-outline"}
      style={{
        fontWeight: 700,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        minHeight: 44,
        padding: "12px 20px",
      }}
    >
      {isDraft ? <IconRocket size={16} /> : <IconX size={16} />}
      {busy
        ? "Memproses..."
        : label ?? (isDraft ? "Publish sekarang" : "Unpublish")}
    </button>
  );
}

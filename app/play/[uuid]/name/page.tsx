"use client";

import { useState, useTransition } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import { IconHand, IconShield } from "@/components/Icon";
import { LogoMark } from "@/components/LogoMark";

export default function PlayNamePage() {
  const router = useRouter();
  const params = useParams<{ uuid: string }>();
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function validate(): string | null {
    if (!name.trim()) return "Nama wajib diisi";
    if (name.trim().length < 2) return "Nama minimal 2 karakter";
    if (name.trim().length > 20) return "Nama maksimal 20 karakter";
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch("/api/play/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shareUuid: params.uuid,
            childName: name.trim(),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Gagal mulai kuis");
          showToast(data.error || "Gagal", "error");
          return;
        }
        router.push(`/play/${params.uuid}/do?attempt=${data.attemptId}&q=1`);
      } catch {
        setError("Network error");
        showToast("Network error", "error");
      }
    });
  };

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
        <main
          className="animate-fade-in"
          style={{
            flex: 1,
            padding: "40px 24px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            position: "relative",
          }}
        >
          <div
            className="glow-veil"
            style={{
              backgroundImage:
                "radial-gradient(circle at 30% 20%, rgba(255, 255, 255, 0.18) 0%, transparent 45%)",
            }}
          />

          <div className="brand-logo" style={{ color: "#fff", marginBottom: 32 }}>
            <LogoMark onDark />
            <span>EaLearn</span>
          </div>

          <div
            className="animate-floaty"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 88,
              height: 88,
              borderRadius: 26,
              background: "rgba(255,255,255,0.18)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.22)",
              marginBottom: 20,
              boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
            }}
          >
            <IconHand size={40} />
          </div>

          <h1
            style={{
              fontSize: 28,
              fontWeight: 800,
              marginBottom: 8,
              letterSpacing: -0.5,
            }}
          >
            Hai! Siapa namamu?
          </h1>
          <p
            style={{
              opacity: 0.92,
              marginBottom: 32,
              fontSize: 15,
            }}
          >
            Biar Bunda tahu hasil kamu
          </p>

          <form
            onSubmit={handleSubmit}
            style={{ width: "100%", maxWidth: 360 }}
          >
            <input
              type="text"
              className="form-control"
              placeholder="Nama kamu"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              autoFocus
              maxLength={20}
              style={{
                textAlign: "center",
                fontSize: 18,
                padding: "16px 20px",
                background: "rgba(255,255,255,0.95)",
                color: "var(--text)",
                border: "none",
                marginBottom: 8,
              }}
            />
            {error && (
              <div
                style={{
                  color: "#fff",
                  background: "rgba(192, 130, 116, 0.4)",
                  padding: "8px 12px",
                  borderRadius: 8,
                  fontSize: 13,
                  marginBottom: 12,
                }}
                role="alert"
              >
                {error}
              </div>
            )}
            <button
              type="submit"
              className="btn btn-accent"
              disabled={isPending}
              style={{ fontWeight: 700, padding: "14px 20px" }}
            >
              {isPending && (
                <span className="btn-spinner" aria-hidden="true" />
              )}
              {isPending ? "Mulai..." : "Mulai Kuis →"}
            </button>
          </form>

          <div
            style={{
              marginTop: 24,
              padding: 12,
              background: "rgba(255,255,255,0.1)",
              borderRadius: "var(--radius)",
              fontSize: 12,
              maxWidth: 320,
              border: "1px solid rgba(255,255,255,0.15)",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                justifyContent: "center",
              }}
            >
              <IconShield size={16} />
              Nama kamu hanya dikirim ke Bunda. Aman.
            </span>
          </div>
        </main>
      </div>
    </>
  );
}

"use client";

import { useEffect } from "react";
import Link from "next/link";
import { MobileFrame } from "@/components/MobileFrame";
import { IconAlertTriangle } from "@/components/Icon";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to error tracking service in production
    console.error("[error boundary]", error);
  }, [error]);

  return (
    <MobileFrame>
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          textAlign: "center",
        }}
        className="animate-fade-in"
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 72,
            height: 72,
            borderRadius: 20,
            background: "var(--danger-soft)",
            color: "var(--danger-ink)",
            margin: "0 auto 16px",
          }}
        >
          <IconAlertTriangle size={32} />
        </div>
        <h1 className="h-title">Terjadi kesalahan</h1>
        <p className="t-muted" style={{ marginBottom: 24, maxWidth: 320 }}>
          Maaf, ada error yang tidak terduga. Coba refresh halaman atau kembali ke dashboard.
        </p>
        {error.digest && (
          <code
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              marginBottom: 16,
              padding: "4px 8px",
              background: "var(--bg-soft)",
              borderRadius: 4,
            }}
          >
            {error.digest}
          </code>
        )}
        <button type="button" onClick={reset} className="btn btn-primary" style={{ maxWidth: 320 }}>
          Coba Lagi
        </button>
        <Link href="/dashboard" className="btn btn-ghost" style={{ maxWidth: 320, marginTop: 8 }}>
          ke Dashboard
        </Link>
      </main>
    </MobileFrame>
  );
}

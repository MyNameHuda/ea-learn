import Link from "next/link";
import { MobileFrame } from "@/components/MobileFrame";

export default function NotFound() {
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
            fontSize: 64,
            fontWeight: 800,
            color: "var(--primary-light)",
            letterSpacing: "-2px",
            marginBottom: 8,
          }}
        >
          404
        </div>
        <h1 className="h-title" style={{ marginBottom: 8 }}>
          Halaman tidak ditemukan
        </h1>
        <p className="t-muted" style={{ marginBottom: 24, maxWidth: 320 }}>
          Link yang kamu buka mungkin sudah dihapus, dipindah, atau tidak pernah ada.
        </p>
        <Link href="/dashboard" className="btn btn-primary" style={{ maxWidth: 320 }}>
          Kembali ke Dashboard
        </Link>
        <Link href="/" className="btn btn-ghost" style={{ maxWidth: 320, marginTop: 8 }}>
          ke Beranda
        </Link>
      </main>
    </MobileFrame>
  );
}

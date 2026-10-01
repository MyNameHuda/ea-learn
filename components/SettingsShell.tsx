import Link from "next/link";
import { IconArrowLeft } from "@/components/Icon";

/**
 * Shared chrome for the /profile/* sub-pages (Notifikasi, Akun, Privasi).
 * Every one of them is "one screen inside Profil", so they all get the same
 * back-to-profile header instead of each hand-rolling one.
 */
export function SettingsShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="bg-aurora bg-aurora-dashboard" aria-hidden="true" />
      <div
        className="shell-mobile-full"
        style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}
      >
        <header className="page-header">
          <Link href="/profile" className="back" aria-label="Kembali ke profil">
            <IconArrowLeft size={20} />
          </Link>
          <h1 style={{ fontSize: 14 }}>{title}</h1>
          <div style={{ width: 36 }} />
        </header>

        <main
          className="animate-fade-in"
          style={{ flex: 1, padding: "20px 16px 40px" }}
        >
          {subtitle && (
            <p className="t-muted" style={{ marginBottom: 20, fontSize: 13, lineHeight: 1.6 }}>
              {subtitle}
            </p>
          )}
          {children}
        </main>
      </div>
    </>
  );
}

/** One labelled on/off row. */
export function ToggleRow({
  title,
  desc,
  checked,
  onChange,
  disabled,
}: {
  title: string;
  desc: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      style={{
        padding: 14,
        display: "flex",
        alignItems: "center",
        gap: 12,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{title}</div>
        <div className="t-soft" style={{ fontSize: 12, marginTop: 2 }}>
          {desc}
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        style={{
          width: 50,
          height: 30,
          borderRadius: 999,
          flexShrink: 0,
          position: "relative",
          border: "none",
          background: checked ? "var(--primary)" : "var(--border)",
          transition: "background-color 0.2s ease",
          cursor: disabled ? "not-allowed" : "pointer",
          padding: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 3,
            left: checked ? 23 : 3,
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: "#fff",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            transition: "left 0.2s ease",
          }}
        />
      </button>
    </label>
  );
}

/** Card that groups related toggles. */
export function SettingsCard({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 20 }}>
      {title && <h3 className="h-section" style={{ marginBottom: 8 }}>{title}</h3>}
      {desc && (
        <p className="t-soft" style={{ fontSize: 12, marginBottom: 12, lineHeight: 1.6 }}>
          {desc}
        </p>
      )}
      <div
        className="card"
        style={{ padding: 0, overflow: "hidden" }}
      >
        {children}
      </div>
    </section>
  );
}

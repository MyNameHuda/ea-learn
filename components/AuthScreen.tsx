"use client";

/**
 * The login / signup screen: one centred column, nothing else.
 *
 * This used to be a two-column split screen. The left column was a marketing
 * panel — gradient, a 32px headline, three benefit lines — and on a phone it
 * was pushed above the form, so the first thing a person saw was decoration
 * and the first thing they had to scroll past to reach the actual fields was
 * more decoration. The panel also gave the error toast a dark surface to land
 * on, which made a white notification slab appear across the top of the page.
 *
 * So the panel is gone. What is left is the logo, the heading, the form, and
 * the one link you need. Centred on the page, at every width.
 */
import { AuthForm, ForgotPasswordNote } from "@/components/AuthForm";
import { LogoMark } from "@/components/LogoMark";

export function AuthScreen({
  mode,
  initialEmail = "",
}: {
  mode: "login" | "signup";
  initialEmail?: string;
}) {
  const isSignup = mode === "signup";

  return (
    <main className="auth-centered animate-fade-in">
      <div className="auth-centered__inner">
        <div className="brand-logo" style={{ justifyContent: "center", marginBottom: 20 }}>
          <LogoMark />
          <span>EaLearn</span>
        </div>

        <h1 className="h-title" style={{ textAlign: "center" }}>
          {isSignup ? "Buat akun" : "Masuk"}
        </h1>
        <p
          className="t-muted"
          style={{ textAlign: "center", marginBottom: 24, fontSize: 14 }}
        >
          {isSignup
            ? "Cuma email dan password. Tidak ada kode verifikasi."
            : "Masuk untuk lanjut bikin kuis latihan."}
        </p>

        <AuthForm mode={mode} initialEmail={initialEmail} />

        {!isSignup && <ForgotPasswordNote />}
      </div>
    </main>
  );
}

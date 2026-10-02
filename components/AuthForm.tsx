"use client";

/**
 * The email + password form, shared by /login and /signup.
 *
 * One component with a `mode` prop rather than two near-identical forms: the
 * two screens were drifting apart (signup grew a confirm field and a strength
 * meter, login grew a "belum punya akun" link) and every shared rule — the
 * password policy, the email pattern, what counts as a valid submission — had
 * to be kept in sync by hand. Now there is only one copy of each.
 *
 * No verification step. Signup creates a usable account immediately; there is no
 * code to request, no code to lose, and no second screen to get stuck on.
 */
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useToast } from "@/components/Toast";
import { IconAlertTriangle } from "@/components/Icon";
import { ContactSupport } from "@/components/ContactSupport";

type Mode = "login" | "signup";

type FieldKey =
  | "displayName"
  | "email"
  | "password"
  | "confirmPassword"
  | "form";

type Errors = Partial<Record<FieldKey, string>>;

// Deliberately loose. The server validates with zod; this only needs to catch
// the obvious typos before a round-trip, so a stricter client rule would
// reject addresses the server would have accepted.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

export function AuthForm({
  mode,
  initialEmail = "",
}: {
  mode: Mode;
  initialEmail?: string;
}) {
  const isSignup = mode === "signup";
  const router = useRouter();
  const { showToast } = useToast();

  const [displayName, setDisplayName] = useState("");
  // Pre-filled when arriving straight from a successful signup, so the person
  // types one field instead of three.
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [saving, startSave] = useTransition();

  /** Cheap live strength read so the rule is visible before submitting. */
  const strength = (() => {
    if (isSignup && password.length > 0) {
      let score = 0;
      if (password.length >= 8) score++;
      if (password.length >= 12) score++;
      if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
      if (/\d/.test(password)) score++;
      if (/[^A-Za-z0-9]/.test(password)) score++;
      return score;
    }
    return null;
  })();
  const strengthLabel = ["Sangat lemah", "Lemah", "Cukup", "Kuat", "Sangat kuat"][
    Math.min(strength ?? 0, 4)
  ];
  const strengthColor = [
    "var(--danger)",
    "var(--danger)",
    "var(--accent-dark)",
    "var(--primary)",
    "var(--primary)",
  ][Math.min(strength ?? 0, 4)];

  function validate(): boolean {
    const e: Errors = {};
    if (isSignup && displayName.trim().length < 2) {
      e.displayName = "Nama minimal 2 karakter";
    }
    if (!email.trim()) e.email = "Email wajib diisi";
    else if (!EMAIL_RE.test(email.trim())) e.email = "Format email tidak valid";

    if (!password) e.password = "Password wajib diisi";
    else if (isSignup && password.length < MIN_PASSWORD) {
      e.password = `Password minimal ${MIN_PASSWORD} karakter`;
    }

    if (isSignup) {
      if (!confirmPassword) e.confirmPassword = "Ulangi password dulu";
      else if (confirmPassword !== password) {
        e.confirmPassword = "Konfirmasi password tidak cocok";
      }
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setErrors({});
    if (!validate()) return;

    startSave(async () => {
      if (isSignup) {
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            displayName: displayName.trim(),
            email: email.trim(),
            password,
            confirmPassword,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          // No toast here. The message is already rendered inline on the field
          // that caused it, and a second copy floated to the top of the page —
          // landing as a white slab across the dark hero panel. Two copies of
          // the same sentence is noise, not redundancy that helps.
          setErrors({ ...(data.fieldErrors ?? {}), form: data.error ?? "Gagal membuat akun" });
          return;
        }
        // Land on the login screen with the email pre-filled, so the person
        // types one field instead of three. This one *is* worth a toast: it
        // confirms a state change they cannot otherwise see.
        //
        // The wording is deliberately conditional. The server answers 201
        // whether or not it actually created a row — it refuses to confirm
        // that an address is taken, because an endpoint that does is a list of
        // your users. So "Akun dibuat" would be a lie in the duplicate case;
        // this sentence is true either way and tells them what to do next.
        showToast(
          "Akun dibuat. Kalau email ini sudah pernah dipakai, cukup masuk dengan passwordmu.",
          "success",
        );
        router.push(`/login?email=${encodeURIComponent(email.trim())}`);
        return;
      }

      const res = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
      });
      if (res?.error) {
        // One message for two causes on purpose. The server rejects a wrong
        // password and a rate-limited attempt identically, and it cannot say
        // which without telling an attacker whether the address has an account
        // here. So this wording covers both without confirming either.
        setErrors({
          form: "Email atau password salah — atau terlalu banyak percobaan dari perangkat ini. Coba lagi dalam 15 menit.",
        });
        return;
      }
      router.push("/dashboard");
      router.refresh();
    });
  }

  const field = (
    label: string,
    value: string,
    setValue: (v: string) => void,
    key: Exclude<FieldKey, "form">,
    type: "text" | "email" | "password",
    autoComplete: string,
    extra?: React.ReactNode,
  ) => (
    <div className="form-group" style={{ marginBottom: 14 }}>
      <label
        htmlFor={`af-${key}`}
        style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: "block" }}
      >
        {label}
      </label>
      <input
        id={`af-${key}`}
        type={type}
        className="form-control"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoComplete={autoComplete}
        autoCapitalize={type === "email" ? "none" : undefined}
        spellCheck={false}
        aria-invalid={Boolean(errors[key])}
        aria-describedby={errors[key] ? `af-${key}-err` : undefined}
        style={errors[key] ? { borderColor: "var(--danger)" } : undefined}
      />
      {errors[key] && (
        <div
          id={`af-${key}-err`}
          style={{ fontSize: 11, color: "var(--danger-ink)", marginTop: 4 }}
        >
          {errors[key]}
        </div>
      )}
      {extra}
    </div>
  );

  return (
    <form onSubmit={submit} noValidate>
      {isSignup &&
        field("Nama", displayName, setDisplayName, "displayName", "text", "name")}

      {field("Email", email, setEmail, "email", "email", "email")}

      {field(
        "Password",
        password,
        setPassword,
        "password",
        "password",
        isSignup ? "new-password" : "current-password",
        isSignup && strength !== null ? (
          <div style={{ marginTop: 6 }}>
            <div
              style={{
                height: 5,
                borderRadius: 999,
                background: "var(--bg-soft)",
                overflow: "hidden",
              }}
              role="img"
              aria-label={`Kekuatan password: ${strengthLabel}`}
            >
              <div
                style={{
                  width: `${(Math.min(strength, 4) / 4) * 100}%`,
                  height: "100%",
                  background: strengthColor,
                  transition: "width 0.2s ease, background-color 0.2s ease",
                }}
              />
            </div>
            <div className="t-soft" style={{ fontSize: 11, marginTop: 4, color: strengthColor }}>
              {strengthLabel}
            </div>
          </div>
        ) : undefined,
      )}

      {isSignup &&
        field(
          "Ulangi password",
          confirmPassword,
          setConfirmPassword,
          "confirmPassword",
          "password",
          "new-password",
        )}

      {errors.form && (
        <div className="alert alert-error" style={{ marginBottom: 14 }}>
          <span
            style={{
              display: "flex",
              flexShrink: 0,
              marginTop: 1,
              color: "var(--danger-ink)",
            }}
          >
            <IconAlertTriangle size={16} />
          </span>
          <div>{errors.form}</div>
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="btn btn-primary"
        style={{ width: "100%", justifyContent: "center", marginTop: 4 }}
      >
        {saving ? "Memproses..." : isSignup ? "Buat Akun" : "Masuk"}
      </button>

      <p
        className="t-soft"
        style={{ marginTop: 16, fontSize: 12, textAlign: "center", lineHeight: 1.7 }}
      >
        {isSignup ? (
          <>
            Sudah punya akun?{" "}
            <Link href="/login" className="text-link">
              Masuk di sini
            </Link>
          </>
        ) : (
          <>
            Belum punya akun?{" "}
            <Link href="/signup" className="text-link">
              Daftar gratis
            </Link>
          </>
        )}
      </p>
    </form>
  );
}

/**
 * The "lupa password" answer, used under the login form.
 *
 * There is no reset link to offer, so it says so and names the two ways to
 * reach a person. Rendered by /login rather than exported for reuse: this is
 * the one place a locked-out person lands, and burying it on a help page is
 * what made it findable in the first place only after people got stuck.
 */
export function ForgotPasswordNote() {
  return (
    <div style={{ marginTop: 20 }}>
      <p
        className="t-soft"
        style={{ fontSize: 12, textAlign: "center", marginBottom: 10, lineHeight: 1.7 }}
      >
        Lupa password? Belum ada reset otomatis — hubungi kami langsung, nanti
        kami bantu atur ulang.
      </p>
      <ContactSupport compact />
    </div>
  );
}

"use client";

/**
 * Change-password form for a signed-in user.
 *
 * Requires the current password even though you are already logged in — that
 * is what stops someone who borrows an unlocked device from quietly locking
 * the owner out of their own account.
 *
 * There is deliberately no "lupa password" link next to it. Recovery needs no
 * proof of identity, so it cannot be done from inside the app; it is handled by
 * a person. See components/ContactSupport.
 *
 * Validation errors come back from the API and land on the specific field, not
 * as one generic banner.
 */
import { useState, useTransition } from "react";
import { useToast } from "@/components/Toast";
import { IconCheck, IconLock } from "@/components/Icon";

type Errors = Partial<
  Record<"currentPassword" | "newPassword" | "confirmPassword" | "form", string>
>;

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [done, setDone] = useState(false);
  const [saving, startSave] = useTransition();
  const { showToast } = useToast();

  // Cheap live feedback so the user isn't only told on submit.
  const strength = (() => {
    if (newPassword.length === 0) return null;
    let score = 0;
    if (newPassword.length >= 8) score++;
    if (newPassword.length >= 12) score++;
    if (/[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword)) score++;
    if (/\d/.test(newPassword)) score++;
    if (/[^A-Za-z0-9]/.test(newPassword)) score++;
    return score;
  })();

  const strengthLabel = [
    "Sangat lemah",
    "Lemah",
    "Cukup",
    "Kuat",
    "Sangat kuat",
  ][Math.min(strength ?? 0, 4)];
  const strengthColor = [
    "var(--danger)",
    "var(--danger)",
    "var(--accent-dark)",
    "var(--primary)",
    "var(--primary)",
  ][Math.min(strength ?? 0, 4)];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setDone(false);
    setErrors({});

    if (!currentPassword) {
      setErrors({ currentPassword: "Masukkan password sekarang" });
      return;
    }
    if (newPassword.length < 8) {
      setErrors({ newPassword: "Password baru minimal 8 karakter" });
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrors({ confirmPassword: "Konfirmasi password tidak cocok" });
      return;
    }

    startSave(async () => {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Inline only — see the note in components/AuthForm.tsx. The toast
        // would restate a message already sitting on the offending field.
        setErrors({ ...(data.fieldErrors ?? {}), form: data.error ?? "Gagal" });
        return;
      }
      setDone(true);
      showToast("Password berhasil diubah", "success");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    });
  }

  const field = (
    label: string,
    value: string,
    setValue: (v: string) => void,
    key: "currentPassword" | "newPassword" | "confirmPassword",
    autoComplete: string,
    extra?: React.ReactNode,
  ) => (
    <div className="form-group" style={{ marginBottom: 14 }}>
      <label
        htmlFor={`cp-${key}`}
        style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: "block" }}
      >
        {label}
      </label>
      <input
        id={`cp-${key}`}
        type="password"
        className="form-control"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoComplete={autoComplete}
        aria-invalid={Boolean(errors[key])}
        aria-describedby={errors[key] ? `cp-${key}-err` : undefined}
        style={errors[key] ? { borderColor: "var(--danger)" } : undefined}
      />
      {errors[key] && (
        <div
          id={`cp-${key}-err`}
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
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        {field("Password sekarang", currentPassword, setCurrentPassword, "currentPassword", "current-password")}

        {field(
          "Password baru",
          newPassword,
          setNewPassword,
          "newPassword",
          "new-password",
          strength !== null ? (
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
              <div
                className="t-soft"
                style={{ fontSize: 11, marginTop: 4, color: strengthColor }}
              >
                {strengthLabel}
              </div>
            </div>
          ) : undefined,
        )}

        {field("Ulangi password baru", confirmPassword, setConfirmPassword, "confirmPassword", "new-password")}

        {errors.form && (
          <div className="alert alert-error" style={{ marginBottom: 14 }}>
            <div>{errors.form}</div>
          </div>
        )}

        <button
          type="submit"
          disabled={saving || !currentPassword || !newPassword || !confirmPassword}
          className="btn btn-primary"
          style={{ width: "100%", justifyContent: "center", marginTop: 4 }}
        >
          <IconLock size={16} />
          {saving ? "Menyimpan..." : "Ubah Password"}
        </button>
      </div>

      <div
        className="card"
        style={{ padding: 14, display: "flex", gap: 10, alignItems: "flex-start" }}
      >
        <span
          style={{ color: "var(--primary-ink)", display: "flex", flexShrink: 0, marginTop: 1 }}
        >
          {done ? <IconCheck size={18} /> : <IconLock size={18} />}
        </span>
        <div className="t-soft" style={{ fontSize: 12, lineHeight: 1.6 }}>
          {done ? (
            <span style={{ color: "var(--primary-ink)", fontWeight: 600 }}>
              Password sudah diganti. Tetap masuk di perangkat ini.
            </span>
          ) : (
            "Minimal 8 karakter. Campur huruf besar, huruf kecil, dan angka jauh lebih sulit ditebak."
          )}
        </div>
      </div>
    </form>
  );
}

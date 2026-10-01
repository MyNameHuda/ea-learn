/**
 * Presentational body of /profile/akun.
 *
 * Split from the page so it can be rendered without a session. The page's only
 * jobs are: authenticate, load the user, hand that user over as a prop.
 *
 * This screen has been through two shapes. It was a password form while
 * sign-in was email + password; it briefly became an "Akun Google" screen when
 * sign-in moved to OAuth; it is back to a password form now. What survived both
 * round trips is the honest bit: the account's email, and — because there is
 * no self-serve recovery — an explicit way to reach a human.
 */
import type { UserRow } from "@/lib/queries";
import { SettingsShell } from "@/components/SettingsShell";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { ContactSupport } from "@/components/ContactSupport";
import { IconMail } from "@/components/Icon";

export function AkunInfo({ user }: { user: UserRow }) {
  const joined = new Date(user.createdAt);
  const joinedLabel = Number.isNaN(joined.getTime())
    ? null
    : joined.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

  return (
    <SettingsShell
      title="Akun & Keamanan"
      subtitle="Email yang dipakai untuk masuk, dan passwordnya."
    >
      <div
        className="card"
        style={{
          padding: 16,
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            borderRadius: 10,
            background: "var(--bg-soft)",
            color: "var(--text-soft)",
            flexShrink: 0,
          }}
        >
          <IconMail size={18} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, wordBreak: "break-all" }}>
            {user.email}
          </div>
          {joinedLabel && (
            <div className="t-soft" style={{ fontSize: 12, marginTop: 2 }}>
              Bergabung {joinedLabel}
            </div>
          )}
        </div>
      </div>

      <h3 className="h-section" style={{ marginBottom: 8 }}>
        Password
      </h3>
      <p className="t-soft" style={{ fontSize: 12, marginBottom: 12, lineHeight: 1.6 }}>
        Butuh password sekarang untuk memastikan kamu yang mengubahnya.
      </p>
      <ChangePasswordForm />

      <div style={{ marginTop: 4 }}>
        <ContactSupport
          title="Lupa password?"
          note="Belum ada reset otomatis, jadi kami bantu manual. Sebutkan email akun kamu, nanti developer atur ulang passwordnya."
        />
      </div>
    </SettingsShell>
  );
}

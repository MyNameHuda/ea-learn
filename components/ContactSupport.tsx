import { IconMail, IconMessageCircle, IconArrowRight } from "@/components/Icon";

/**
 * Where a stuck user goes when the app cannot help them.
 *
 * EaLearn has no self-serve password recovery on purpose: the reset-by-email
 * flow was removed because it needed an outbound mailer we had no reason to
 * run, and a "kirim kode" button that silently never sends anything is worse
 * than saying plainly who to talk to. So the answer is a person, reachable two
 * ways, with the address and number written out rather than hidden behind a
 * contact form nobody monitors.
 *
 * The two contact rows and their targets live here so the login page, the
 * account page and the help page cannot drift apart.
 */
export const SUPPORT_EMAIL = "nrlhuda2904@gmail.com";
export const SUPPORT_WHATSAPP = "6281388853100";

export function ContactSupport({
  /** Small heading above the rows. Omit for the compact inline variant. */
  title,
  /** One line explaining *when* to use this. */
  note,
  /** Denser layout for the login page, where vertical space is scarce. */
  compact = false,
}: {
  title?: string;
  note?: string;
  compact?: boolean;
}) {
  const rows = [
    {
      href: `mailto:${SUPPORT_EMAIL}?subject=Bantuan%20EaLearn`,
      icon: IconMail,
      label: "Email",
      value: SUPPORT_EMAIL,
      external: false,
    },
    {
      href: `https://wa.me/${SUPPORT_WHATSAPP}?text=Halo%20EaLearn%2C%20saya%20butuh%20bantuan`,
      icon: IconMessageCircle,
      label: "WhatsApp",
      value: "0813 8885 3100 · balasan 1×24 jam kerja",
      external: true,
    },
  ];

  return (
    <section>
      {title && <h3 className="h-section" style={{ marginBottom: 8 }}>{title}</h3>}
      {note && (
        <p className="t-soft" style={{ fontSize: 12, marginBottom: 12, lineHeight: 1.6 }}>
          {note}
        </p>
      )}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {rows.map((r, i) => (
          <a
            key={r.label}
            href={r.href}
            {...(r.external
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {})}
            style={{
              padding: compact ? 12 : 14,
              display: "flex",
              alignItems: "center",
              gap: 12,
              borderTop: i > 0 ? "1px solid var(--border-soft)" : undefined,
              textDecoration: "none",
              color: "var(--text)",
            }}
          >
            <span
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "var(--bg-soft)",
                color: "var(--text-soft)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <r.icon size={18} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{r.label}</div>
              <div className="t-soft" style={{ fontSize: 12, wordBreak: "break-all" }}>
                {r.value}
              </div>
            </div>
            <span style={{ color: "var(--text-muted)", display: "flex", flexShrink: 0 }}>
              <IconArrowRight size={14} />
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}

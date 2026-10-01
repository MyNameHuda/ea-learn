"use client";

/**
 * ShareActions — the interactive half of /quiz/[id]/share.
 *
 * This used to be rendered inline from a Server Component. No "use client", no
 * state, and every button was dead: "Copy Link" did nothing on tap and the six
 * channel tiles were decorative rectangles. A parent tapping "Copy Link" and
 * getting no response is a total failure of the one job this screen exists to
 * do, so the buttons now do real work.
 *
 *   - Copy   → navigator.clipboard, with a visible copied state
 *   - Share  → Web Share API when the device has it (the good path on phones)
 *   - Tiles  → real wa.me / t.me / mailto: / sms: deep links
 *
 * Every channel also degrades safely: if the clipboard API is blocked (older
 * browsers, non-secure origins) we say so and leave the link selectable rather
 * than silently doing nothing.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  IconCheck,
  IconCopy,
  IconMail,
  IconMessageCircle,
  IconSend,
  IconShare,
} from "@/components/Icon";

type Props = {
  shareUrl: string;
  title: string;
};

const MESSAGE = (title: string) =>
  `Hai! Aku baru buat kuis "${title}". Coba kerjakan ya, lewat link ini:`;

export default function ShareActions({ shareUrl, title }: Props) {
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const flash = useCallback((msg: string) => {
    setNotice(msg);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setCopied(false);
      setNotice(null);
    }, 2400);
  }, []);

  /**
   * Legacy copy path. `navigator.clipboard` is refused in more real situations
   * than people expect: older Firefox, non-secure origins, enterprise
   * clipboard policies, and automation contexts all reject with
   * NotAllowedError. A hidden textarea + execCommand still works there, and a
   * copy button that silently does nothing is worse than one that never
   * shipped.
   */
  const legacyCopy = useCallback((text: string) => {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-9999px";
    ta.style.left = "-9999px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    document.body.removeChild(ta);
    return ok;
  }, []);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      flash("Link tersalin!");
      return;
    } catch {
      // fall through to the legacy path
    }
    if (legacyCopy(shareUrl)) {
      setCopied(true);
      flash("Link tersalin!");
      return;
    }
    setCopied(false);
    flash("Browser menolak copy otomatis — blok link di bawah, lalu salin manual.");
  }, [shareUrl, flash, legacyCopy]);

  const nativeShare = useCallback(async () => {
    const nav = navigator as Navigator & {
      share?: (data: { title: string; text: string; url: string }) => Promise<void>;
    };
    if (!nav.share) {
      // No Web Share API (desktop Chrome/Firefox) → copying is the useful act.
      await copyLink();
      return;
    }
    try {
      await nav.share({ title, text: title, url: shareUrl });
    } catch {
      // User dismissed the sheet. Not an error worth surfacing.
    }
  }, [title, shareUrl, copyLink]);

  const message = `${MESSAGE(title)} ${shareUrl}`;

  const channels = [
    {
      name: "WhatsApp",
      icon: IconMessageCircle,
      color: "#25D366",
      href: `https://wa.me/?text=${encodeURIComponent(message)}`,
    },
    {
      name: "Telegram",
      icon: IconSend,
      color: "#0088cc",
      href: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(title)}`,
    },
    {
      name: "Email",
      icon: IconMail,
      color: "#2a63b8", // Email — brand blue; literal because the tile
      // tint below is built as `${c.color}1a`, which a var() cannot do.
      href: `mailto:?subject=${encodeURIComponent(`Kuis latihan: ${title}`)}&body=${encodeURIComponent(message)}`,
    },
    {
      name: "SMS",
      icon: IconShare,
      color: "#8a6313", // SMS — accent ink, same literal-hex reason
      // iOS wants `sms:<body>`, Android wants `sms:?body=<body>`.
      href: `sms:${encodeURIComponent(`${title} — ${shareUrl}`)}`,
    },
  ];

  return (
    <>
      {/* Primary action: native share sheet where available, copy otherwise. */}
      <button
        type="button"
        onClick={nativeShare}
        className="btn btn-accent"
        style={{ width: "100%", justifyContent: "center", fontWeight: 700 }}
      >
        <IconShare size={16} />
        Bagikan ke anak
      </button>

      {/* The link itself — always visible, always selectable. */}
      <div
        style={{
          marginTop: 16,
          background: "rgba(255,255,255,0.16)",
          border: "1px solid rgba(255,255,255,0.2)",
          borderRadius: "var(--radius)",
          padding: "10px 12px",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: 12,
          lineHeight: 1.45,
          wordBreak: "break-all",
          color: "#fff",
          userSelect: "all",
        }}
      >
        {shareUrl}
      </div>

      <button
        type="button"
        onClick={copyLink}
        className="btn"
        aria-live="polite"
        style={{
          width: "100%",
          justifyContent: "center",
          marginTop: 10,
          background: copied ? "rgba(255,255,255,0.38)" : "rgba(255,255,255,0.25)",
          color: "#fff",
          padding: "10px 16px",
          fontSize: 13,
          fontWeight: 600,
          transition: "background-color 0.2s ease",
        }}
      >
        {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
        {copied ? "Tersalin!" : "Copy Link"}
      </button>

      {notice && !copied && (
        <p
          role="status"
          style={{
            marginTop: 8,
            fontSize: 12,
            lineHeight: 1.5,
            color: "rgba(255,255,255,0.88)",
          }}
        >
          {notice}
        </p>
      )}

      {/* Channel tiles — each opens a real share target. */}
      <h3
        style={{
          fontSize: 14,
          fontWeight: 600,
          margin: "28px 0 12px",
          textAlign: "left",
          opacity: 0.92,
        }}
      >
        Atau share via
      </h3>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 10,
        }}
      >
        {channels.map((c) => (
          <a
            key={c.name}
            href={c.href}
            target="_blank"
            rel="noopener noreferrer"
            className="card"
            style={{
              padding: 14,
              background: "rgba(255,255,255,0.95)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              border: "none",
              textDecoration: "none",
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 44,
                height: 44,
                borderRadius: 12,
                background: `${c.color}1a`,
                color: c.color,
              }}
            >
              <c.icon size={22} />
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text)",
              }}
            >
              {c.name}
            </span>
          </a>
        ))}
      </div>
    </>
  );
}

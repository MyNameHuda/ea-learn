/**
 * Icon — simple SVG icon system (no external deps).
 * Add new icons here as needed.
 *
 * `style` is deliberately NOT in IconProps. Every icon destructures only
 * `{ size, className }` and forwards nothing else to the <svg>, so a `style`
 * prop would type-check and then be silently dropped on the floor — that is
 * exactly how the "back" arrow on /profile ended up pointing forwards when
 * someone tried to rotate an IconArrowRight instead of using IconArrowLeft.
 * Leaving it out turns that silent failure into a compile error.
 */

type IconProps = {
  size?: number;
  className?: string;
  "aria-hidden"?: boolean;
};

/** Exported so callers can accept an icon as a prop instead of hard-coding
 *  one. v3 typed every icon prop as `string`, which is why they ended up
 *  holding emoji. */
export type IconComponent = (props: IconProps) => React.JSX.Element;

const base = (size = 18) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export function IconHome({ size, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

export function IconList({ size, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

export function IconChart({ size, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="18" y1="20" x2="18" y2="4" />
      <line x1="6" y1="20" x2="6" y2="16" />
    </svg>
  );
}

export function IconUser({ size, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export function IconPlus({ size, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

export function IconArrowLeft({ size, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

export function IconArrowRight({ size, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

export function IconCheck({ size, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function IconX({ size, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

/** Delete/remove. Distinct from IconX so "hapus" never shares its glyph with
 *  "tutup" — the quiz delete action in QuizActions.tsx needs to read as
 *  destructive at a glance. */
export function IconTrash({ size, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

export function IconClock({ size, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

export function IconShare({ size, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

export function IconCopy({ size, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function IconLogOut({ size, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

export function IconClipboard({ size, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  );
}

export function IconBook({ size, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

export function IconBeaker({ size, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M9 2v6L4 18a2 2 0 0 0 1.7 3h12.6a2 2 0 0 0 1.7-3L15 8V2" />
      <line x1="9" y1="2" x2="15" y2="2" />
    </svg>
  );
}

export function IconCalculator({ size, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <line x1="8" y1="6" x2="16" y2="6" />
      <line x1="16" y1="14" x2="16" y2="18" />
      <line x1="8" y1="14" x2="12" y2="14" />
      <line x1="8" y1="18" x2="12" y2="18" />
      <line x1="8" y1="10" x2="16" y2="10" />
    </svg>
  );
}

export function IconEdit({ size, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

export function IconChild({ size, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="5" r="2" />
      <path d="M8 22v-7l-3-3 2-2 3 3 3-3h4l3 3 3-3 2 2-3 3v7" />
    </svg>
  );
}

/* --------------------------------------------------------------------------
   Added in v4 — the app had ~21 files using emoji (🏠 📝 📊 👤 ✅ 🎉 …) as
   UI icons while this hand-rolled set sat nearly unused. Emoji render at a
   different size, weight and colour on every OS and cannot inherit
   currentColor, so they clashed with the palette; these can.
   All follow the same 24x24 / stroke-2 Feather grid as the originals.
   -------------------------------------------------------------------------- */

export function IconBell({ size, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}

export function IconSend({ size, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

export function IconMail({ size, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

export function IconMessageCircle({ size, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z" />
    </svg>
  );
}

export function IconPhone({ size, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  );
}

export function IconPartyPopper({ size, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M5.9 18.1 3 21l3 3 2.9-2.9" />
      <path d="M14.5 3.5 21 10l-9 9-6.5-6.5 9-9z" />
      <path d="M2.5 6.5 6 5l-1 3.5" />
      <path d="M17 2.5 18.5 6 22 4.5" />
    </svg>
  );
}

export function IconTrophy({ size, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M7 4h10v6a5 5 0 0 1-10 0V4z" />
      <path d="M17 5h3a1 1 0 0 1 1 1v1a3 3 0 0 1-3 3" />
      <path d="M7 5H4a1 1 0 0 0-1 1v1a3 3 0 0 0 3 3" />
    </svg>
  );
}

export function IconZap({ size, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

export function IconHeart({ size, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21.2l7.7-7.7 1.1-1a5.5 5.5 0 0 0 0-7.8z" />
    </svg>
  );
}

export function IconLock({ size, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export function IconKey({ size, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="7.5" cy="15.5" r="4.5" />
      <path d="m10.7 12.3 8.3-8.3" />
      <path d="m17 6 2.5 2.5" />
      <path d="m14.5 8.5 2.5 2.5" />
    </svg>
  );
}

export function IconShield({ size, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

export function IconHelpCircle({ size, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export function IconAlertTriangle({ size, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export function IconTarget({ size, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

export function IconRocket({ size, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2.1-.1-2.9a2 2 0 0 0-2.9-.1z" />
      <path d="M12 15 9 12a11 11 0 0 1 2-6c2.5-2.5 6-3 9-3 0 3-.5 6.5-3 9a11 11 0 0 1-6 2z" />
      <path d="M9 12H4s.5-2.5 2-4c1.6-1.4 5 0 5 0" />
      <path d="M12 15v5s2.5-.5 4-2c1.4-1.6 0-5 0-5" />
      <circle cx="16" cy="8" r="1" />
    </svg>
  );
}

export function IconPenTool({ size, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M12 19l7-7 3 3-7 7-3-3z" />
      <path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
      <path d="m2 2 7.586 7.586" />
      <circle cx="11" cy="11" r="2" />
    </svg>
  );
}

export function IconLightbulb({ size, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M15.1 14c.5-1 .9-1.4 1.6-2.1A6 6 0 1 0 6 8a6 6 0 0 0 2.3 4.7c.7.7 1.2 1.3 1.6 2.1" />
    </svg>
  );
}

export function IconInbox({ size, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z" />
    </svg>
  );
}

export function IconImage({ size, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

export function IconFlask({ size, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M9 2v6.5L3.5 18a2 2 0 0 0 1.7 3h13.6a2 2 0 0 0 1.7-3L15 8.5V2" />
      <line x1="8" y1="2" x2="16" y2="2" />
      <line x1="6.5" y1="14" x2="17.5" y2="14" />
    </svg>
  );
}

export function IconHand({ size, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M18 11V6a2 2 0 0 0-4 0v5" />
      <path d="M14 10V4a2 2 0 0 0-4 0v6" />
      <path d="M10 10.5V6a2 2 0 0 0-4 0v8" />
      <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2a8 8 0 0 1-8-8 2 2 0 1 1 4 0" />
    </svg>
  );
}

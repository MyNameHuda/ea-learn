/**
 * LogoMark — the EaLearn brand mark.
 *
 * Lives in its own component because it appears in nine places across the
 * app (landing, login, the kid-facing /play screens, and the profile pages).
 * Each of those previously hard-coded a gradient tile with a letter "E" typed
 * into it, which was a placeholder standing in for a logo that did not exist.
 *
 * `onDark` exists because the artwork's graduation cap is navy: on the dark
 * aurora panels of /play it would disappear, so it sits on a light rounded
 * plate instead. The login screen no longer needs it — it is light now.
 *
 * `/logo-mark.png` is the character cropped out of the supplied lockup (the
 * source file stacks the character above the "EaLearn" wordmark). Every
 * brand-logo row already renders the wordmark as a text <span>, so the mark
 * must be icon-only — using the full square printed "EaLearn EaLearn".
 *
 * A plain <img> rather than next/image: this is a 38px decorative glyph, and
 * routing it through the image optimiser buys nothing at that size.
 */
export function LogoMark({
  onDark = false,
  size = 38,
}: {
  onDark?: boolean;
  size?: number;
}) {
  return (
    <div
      className={onDark ? "logo-mark brand-logo-on-dark" : "logo-mark"}
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-mark.png" alt="" aria-hidden="true" />
    </div>
  );
}

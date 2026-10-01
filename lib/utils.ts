/**
 * Utility helpers used across pages.
 */

export function timeAgoID(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 0) return "baru saja";
  if (seconds < 60) return "baru saja";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "kemarin";
  if (days < 7) return `${days} hari lalu`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks} minggu lalu`;
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

/**
 * Render a millisecond span as words a parent reads without translating:
 * "42 detik", "7 menit", "1 jam 12 menit".
 *
 * Returns null below 5s. An attempt graded in a single request can land at 0s,
 * and "0 detik" reads like a bug rather than a fast answer.
 */
export function durationFromMs(ms: number): string | null {
  if (!Number.isFinite(ms) || ms < 5_000) return null;
  // Under a minute, minutes round to "0 menit", which looks broken. Show
  // seconds instead — "42 detik" is the honest reading for a quick quiz.
  if (ms < 60_000) return `${Math.round(ms / 1000)} detik`;
  const totalMinutes = Math.round(ms / 60_000);
  if (totalMinutes < 60) return `${totalMinutes} menit`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours} jam` : `${hours} jam ${minutes} menit`;
}

/**
 * How long a child actually spent on an attempt, from the two attempt
 * timestamps. Null when either is missing or the gap is not meaningful.
 */
export function durationID(
  startedAt: string | null | undefined,
  submittedAt: string | null | undefined,
): string | null {
  if (!startedAt || !submittedAt) return null;
  return durationFromMs(
    new Date(submittedAt).getTime() - new Date(startedAt).getTime(),
  );
}

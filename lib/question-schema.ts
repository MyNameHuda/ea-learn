/**
 * Question validation, shared by the create and update endpoints.
 *
 * These lived inline in the POST route only, which left PATCH taking a raw
 * body straight into updateQuestion() with no checks at all — and PATCH is the
 * path the editor uses every time the answer key changes on blur. An invariant
 * that only the "add" route enforces is not an invariant.
 */
import { z } from "zod";

/**
 * Exactly one correct answer.
 *
 * Stored as a JSON array because that is the shape lib/grading.ts compares
 * against, but the array is now length 1.
 *
 * The ceiling matters. Grading requires the child's answer to match the key
 * exactly, so a key with two indices is a question a child cannot get right
 * unless they happen to know both are correct — and nothing on the child's
 * screen would ever tell them. The editor used to offer a checkbox, which
 * invited exactly that by accident.
 */
const correctAnswer = z
  .array(z.number().int().nonnegative())
  .min(1, "Pilih satu jawaban benar")
  .max(1, "Hanya boleh satu jawaban benar");

/**
 * Where an uploaded question image lives.
 *
 * Two shapes, because there are two storage backends:
 *   - Cloudinary (production):
 *       https://res.cloudinary.com/<cloud>/image/upload/<public_id>.<ext>
 *   - disk (development only):
 *       /uploads/questions/<name>.<ext>
 *
 * Constrained to those two forms rather than "any string". Unconstrained, this
 * field would accept `javascript:…` or an arbitrary external URL, and the value
 * is rendered straight into an <img src> on the child's screen.
 *
 * The extension whitelist mirrors the magic-byte check in /api/upload, so a
 * hand-crafted request cannot land an .svg here and have it rendered inline.
 * `javascript:` and `data:` are excluded by requiring either a single leading
 * slash or an https:// origin — neither scheme can be dressed up to match.
 */
const IMAGE_EXT = String.raw`(?:png|jpg|jpeg|gif|webp)`;

const imageUrl = z
  .string()
  .max(500)
  .refine(
    (v) =>
      // Cloudinary. The cloud name segment is Cloudinary's own slug, and the
      // version prefix (v123…) is optional because it only appears when the
      // upload was transformed after the fact.
      new RegExp(
        `^https://res\\.cloudinary\\.com/[A-Za-z0-9_-]+/image/(?:private_)?upload/[A-Za-z0-9_\\-/.]+\\.${IMAGE_EXT}$`,
      ).test(v) ||
      // Local development fallback.
      new RegExp(`^/uploads/questions/[A-Za-z0-9._-]+\\.${IMAGE_EXT}$`).test(v),
    "URL gambar tidak valid",
  )
  .optional()
  .or(z.literal("").transform(() => undefined));

export const pgSchema = z.object({
  type: z.literal("multiple_choice"),
  prompt: z.string().max(500),
  options: z.array(z.string().max(200)).min(2).max(6),
  correctAnswer,
  imageUrl,
  points: z.number().int().min(1).max(100).default(10),
});

export const essaySchema = z.object({
  type: z.literal("essay"),
  prompt: z.string().max(500),
  keywords: z.array(z.string().max(50)).min(1).max(10),
  keywordWeights: z.array(z.number().int().min(1).max(5)).min(1).max(10),
  imageUrl,
  points: z.number().int().min(1).max(20).default(20),
});

export const questionSchema = z.discriminatedUnion("type", [pgSchema, essaySchema]);

/** Flattens a ZodError into `{ field: message }` for the form to render. */
export function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !out[key]) out[key] = issue.message;
  }
  return out;
}

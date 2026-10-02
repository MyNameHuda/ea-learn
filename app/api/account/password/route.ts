import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getUserById, updateUserPassword } from "@/lib/queries/data";

/**
 * POST /api/account/password — change your own password.
 *
 * Distinct from account recovery: this proves you know the current password,
 * whereas recovery ("lupa password") has no such proof and is handled by a
 * human — see components/ContactSupport. There is no self-serve reset link.
 *
 * The current password is required even though the caller is already signed in.
 * That is deliberate: it stops someone who briefly borrows an unlocked device
 * from quietly locking the owner out of their own account.
 *
 * Bumping token_version at the end is the other half. Requiring the current
 * password proves *this* caller is the owner; it does nothing about a session
 * cookie that is already in someone else's hands. Before the bump, a parent
 * who reset a leaked password stayed logged in and so did the thief, both for
 * the full 30 days. Now the reset ends every session, including this one.
 */

import { clientIp, hit, KEYS, LIMITS } from "@/lib/rate-limit";
import { bumpTokenVersion } from "@/lib/queries/data";

const BCRYPT_ROUNDS = 10;

const schema = z
  .object({
    currentPassword: z.string().min(1, "Masukkan password sekarang"),
    newPassword: z
      .string()
      .min(8, "Password baru minimal 8 karakter")
      .max(200, "Password baru terlalu panjang"),
    confirmPassword: z.string().min(1, "Ulangi password baru"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Konfirmasi password tidak cocok",
    path: ["confirmPassword"],
  });

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  }

  // A logged-in attacker holding a stolen cookie can still brute-force the
  // password field here, so the endpoint is budgeted on its own account.
  const budget = await hit(
    KEYS.passwordUser(session.user.id),
    LIMITS.password.perUser,
    LIMITS.password.windowMs,
  );
  if (!budget.ok) {
    return NextResponse.json(
      {
        error: `Terlalu banyak percobaan. Coba lagi dalam ${Math.ceil(budget.retryAfter / 60)} menit.`,
      },
      { status: 429, headers: { "Retry-After": String(budget.retryAfter) } },
    );
  }

  const user = await getUserById(session.user.id);
  if (!user?.passwordHash) {
    return NextResponse.json(
      { error: "Akun ini tidak punya password yang bisa diubah." },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Permintaan harus berupa JSON." },
      { status: 400 },
    );
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    return NextResponse.json(
      { error: "Periksa lagi isianmu.", fieldErrors },
      { status: 400 },
    );
  }

  const { currentPassword, newPassword } = parsed.data;

  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    return NextResponse.json(
      {
        error: "Password sekarang salah.",
        fieldErrors: { currentPassword: "Password sekarang salah." },
      },
      { status: 400 },
    );
  }

  if (currentPassword === newPassword) {
    return NextResponse.json(
      {
        error: "Password baru harus berbeda dari yang lama.",
        fieldErrors: { newPassword: "Password baru harus berbeda dari yang lama." },
      },
      { status: 400 },
    );
  }

  await updateUserPassword(user.id, await bcrypt.hash(newPassword, BCRYPT_ROUNDS));

  // Invalidates every session, including this request's own. The caller will
  // be bounced to the login screen and has to sign in again with the new
  // password — which is the point.
  await bumpTokenVersion(user.id);

  return NextResponse.json({ ok: true, reauth: true });
}

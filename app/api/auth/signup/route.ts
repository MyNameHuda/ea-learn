import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { createUser, getUserByEmail } from "@/lib/queries/data";

/**
 * POST /api/auth/signup — create an account.
 *
 * No verification code is sent, on purpose. The code round-trip used to exist
 * to prove the person controlled the address they had just typed; it proved
 * nothing beyond what the password login itself would prove on the first real
 * use, and it was a way to lock yourself out of an account you had just made.
 * Account recovery is handled by a human instead — see components/ContactSupport.
 *
 * The response always carries `fieldErrors`, keyed by input name, so the form
 * can put each message on the field that caused it rather than in one banner.
 *
 * ── Uniform response ────────────────────────────────────────────────────────
 * This used to answer 409 "email ini sudah terdaftar" for a duplicate, which
 * is a perfect oracle: walk any list of addresses and the ones that light up
 * are the ones with an account. It now answers 201 with the same body either
 * way, and the message is written to be true in both cases.
 *
 * The cost is real — someone who mistypes into an address that already exists
 * will not be told so, and will find out at the login screen. That is the
 * standard trade for not publishing the user list, and the alternative here
 * was publishing it.
 */

import { clientIp, hit, KEYS, LIMITS } from "@/lib/rate-limit";

// bcrypt cost 10 is the library default: ~100ms per hash on commodity hardware,
// which is slow enough to make offline cracking expensive and fast enough that
// a legitimate signup still feels instant.
const BCRYPT_ROUNDS = 10;

const schema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(2, "Nama minimal 2 karakter")
      .max(60, "Nama terlalu panjang"),
    email: z.email("Format email tidak valid"),
    password: z
      .string()
      .min(8, "Password minimal 8 karakter")
      .max(200, "Password terlalu panjang"),
    confirmPassword: z.string().min(1, "Ulangi password dulu"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Konfirmasi password tidak cocok",
    path: ["confirmPassword"],
  });

type FieldKey = "displayName" | "email" | "password" | "confirmPassword";

export async function POST(req: Request) {
  // Signup is unauthenticated, so it is the cheapest place to manufacture
  // accounts. Ten per hour per address is far above a real person and far
  // below a spam run.
  const budget = await hit(
    KEYS.signupIp(clientIp(req)),
    LIMITS.signup.perIp,
    LIMITS.signup.windowMs,
  );
  if (!budget.ok) {
    return NextResponse.json(
      { error: "Terlalu banyak pendaftaran dari perangkat ini. Coba lagi nanti." },
      { status: 429, headers: { "Retry-After": String(budget.retryAfter) } },
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

  const { displayName, email, password } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();

  // Hashed before the duplicate check, not after. Both branches have to pay
  // for the same work or the response time becomes the oracle the 409 used to
  // be: ~90 ms for an address that is free versus ~2 ms for one that is taken
  // is just as readable as a status code. Hashing first costs one wasted hash
  // on the rare duplicate and closes the channel completely.
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  if (await getUserByEmail(normalizedEmail)) {
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  await createUser({
    email: normalizedEmail,
    passwordHash,
    displayName: displayName.trim(),
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}

export type { FieldKey };

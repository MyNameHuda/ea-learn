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
 */

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

  if (await getUserByEmail(normalizedEmail)) {
    // 409, not 400: the request was well-formed, the resource already exists.
    return NextResponse.json(
      {
        error: "Email ini sudah terdaftar.",
        fieldErrors: { email: "Sudah punya akun? Masuk saja, atau hubungi kami." },
      },
      { status: 409 },
    );
  }

  await createUser({
    email: normalizedEmail,
    passwordHash: bcrypt.hashSync(password, BCRYPT_ROUNDS),
    displayName: displayName.trim(),
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}

export type { FieldKey };

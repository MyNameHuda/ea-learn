// PATCH /api/settings — persist notification + privacy preferences.
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { updateUserSettings } from "@/lib/queries/data";

const bool = z.boolean();

const schema = z
  .object({
    notifyEmail: bool.optional(),
    notifyWhatsapp: bool.optional(),
    notifyInapp: bool.optional(),
    notifyAttempt: bool.optional(),
    anonymousShare: bool.optional(),
    allowAnalytics: bool.optional(),
    allowMarketing: bool.optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "Tidak ada perubahan untuk disimpan",
  });

export async function PATCH(req: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Belum masuk" }, { status: 401 });
    }

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Input tidak valid" }, { status: 400 });
    }

    await updateUserSettings(userId, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[settings]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

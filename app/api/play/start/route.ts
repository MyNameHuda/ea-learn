// POST /api/play/start — Start an attempt (child enters name)
import { NextResponse } from "next/server";
import { z } from "zod";
import { getQuizByShareUuid } from "@/lib/queries/data";
import { createAttempt } from "@/lib/queries/data";
import { clientIp, hit, KEYS, LIMITS } from "@/lib/rate-limit";

const schema = z.object({
  shareUuid: z.string().min(10),
  childName: z.string().min(2).max(20),
});

export async function POST(req: Request) {
  try {
    // No account, no session, no secret beyond the link itself — so this is the
    // cheapest endpoint on the site to hammer. A script that reloads the page
    // with a fresh name fills the parent's results list with junk attempts.
    const budget = await hit(
      KEYS.playStartIp(clientIp(req)),
      LIMITS.playStart.perIp,
      LIMITS.playStart.windowMs,
    );
    if (!budget.ok) {
      return NextResponse.json(
        { error: "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi." },
        { status: 429, headers: { "Retry-After": String(budget.retryAfter) } },
      );
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const quiz = await getQuizByShareUuid(parsed.data.shareUuid);
    if (!quiz || quiz.status !== "ready") {
      return NextResponse.json({ error: "Kuis tidak tersedia" }, { status: 404 });
    }

    const attempt = await createAttempt({
      quizId: quiz.id,
      childName: parsed.data.childName.trim(),
    });

    return NextResponse.json({
      attemptId: attempt.id,
      quizTitle: quiz.title,
    });
  } catch (e) {
    console.error("[play start]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

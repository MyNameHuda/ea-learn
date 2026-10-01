// POST /api/play/start — Start an attempt (child enters name)
import { NextResponse } from "next/server";
import { z } from "zod";
import { getQuizByShareUuid } from "@/lib/queries/data";
import { createAttempt } from "@/lib/queries/data";

const schema = z.object({
  shareUuid: z.string().min(10),
  childName: z.string().min(2).max(20),
});

export async function POST(req: Request) {
  try {
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

// POST /api/attempt/[id]/review — Parent essay review
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  getAttemptById,
  getUserById,
  getQuizById,
} from "@/lib/queries/data";
import { reviewEssayAnswer } from "@/lib/grading";

const schema = z.object({
  answerId: z.string(),
  finalScore: z.number().int().min(0),
  parentComment: z.string().max(500).nullable().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = await getUserById(session.user.id);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const attempt = await getAttemptById((await params).id);
    if (!attempt) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const quiz = await getQuizById(attempt.quizId);
    if (!quiz || quiz.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const result = reviewEssayAnswer(
      parsed.data.answerId,
      parsed.data.finalScore,
      parsed.data.parentComment ?? null,
      attempt.id,
    );

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[review essay]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

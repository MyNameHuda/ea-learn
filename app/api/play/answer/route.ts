// POST /api/play/answer — Save answer for a question
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  saveAnswer,
  getAttemptById,
  getQuestionById,
} from "@/lib/queries/data";

const pgSchema = z.object({
  attemptId: z.string(),
  questionId: z.string(),
  type: z.literal("multiple_choice"),
  selectedIndices: z.array(z.number().int().nonnegative()).min(0),
});

const essaySchema = z.object({
  attemptId: z.string(),
  questionId: z.string(),
  type: z.literal("essay"),
  text: z.string().max(1000),
});

const baseSchema = z.discriminatedUnion("type", [pgSchema, essaySchema]);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = baseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    // Verify attempt exists
    const attempt = await getAttemptById(parsed.data.attemptId);
    if (!attempt) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    }
    if (attempt.status !== "in_progress") {
      return NextResponse.json(
        { error: "Attempt sudah disubmit" },
        { status: 400 },
      );
    }

    const question = await getQuestionById(parsed.data.questionId);
    if (!question || question.quizId !== attempt.quizId) {
      return NextResponse.json({ error: "Question tidak valid" }, { status: 400 });
    }

    const response =
      parsed.data.type === "multiple_choice"
        ? JSON.stringify(parsed.data.selectedIndices)
        : parsed.data.text;

    await saveAnswer({
      attemptId: parsed.data.attemptId,
      questionId: parsed.data.questionId,
      response,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[play answer]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

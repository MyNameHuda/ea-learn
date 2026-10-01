// POST /api/play/submit — Submit attempt (triggers auto-grade)
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAttemptById } from "@/lib/queries/data";
import { autoGradeAttempt } from "@/lib/grading";

const schema = z.object({
  attemptId: z.string(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const attempt = await getAttemptById(parsed.data.attemptId);
    if (!attempt) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    }
    if (attempt.status !== "in_progress") {
      return NextResponse.json({ error: "Already submitted" }, { status: 400 });
    }

    const summary = await autoGradeAttempt(parsed.data.attemptId);
    return NextResponse.json({
      ok: true,
      summary: {
        totalScore: summary.totalScore,
        maxScore: summary.maxScore,
        mcScore: summary.mcScore,
        mcMax: summary.mcMax,
        essayAutoScore: summary.essayAutoScore,
        essayMax: summary.essayMax,
        essayPendingCount: summary.essayPendingCount,
      },
    });
  } catch (e) {
    console.error("[play submit]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

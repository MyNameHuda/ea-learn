// GET /api/play/fetch?attempt=xxx&q=N — Fetch question N for an attempt
import { NextResponse } from "next/server";
import { getAttemptById, listQuizQuestions, getAnswerByQ } from "@/lib/queries/data";
import { getQuizByShareUuid, getQuizById } from "@/lib/queries/data";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const attemptId = url.searchParams.get("attempt");
    const qNumStr = url.searchParams.get("q");
    if (!attemptId || !qNumStr) {
      return NextResponse.json({ error: "Missing params" }, { status: 400 });
    }
    const qNum = parseInt(qNumStr);

    const attempt = await getAttemptById(attemptId);
    if (!attempt) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    }
    if (attempt.status !== "in_progress") {
      // Already submitted — treat as done
      return NextResponse.json({ done: true, attemptId });
    }

    const questions = await listQuizQuestions(attempt.quizId);
    const question = questions.find((q) => q.orderIndex === qNum);
    if (!question) {
      // No more questions → done
      return NextResponse.json({ done: true, attemptId });
    }

    const prevAnswer = await getAnswerByQ(attemptId, question.id);

    // Get quiz title for context
    const quiz = await getQuizById(attempt.quizId);

    return NextResponse.json({
      done: false,
      attempt: {
        attemptId: attempt.id,
        quizTitle: quiz?.title ?? "",
        total: questions.length,
      },
      question: {
        questionId: question.id,
        type: question.type,
        prompt: question.prompt,
        options: question.options,
        points: question.points,
        // A diagram is part of the question, not a hint — the child has to see
        // it to answer. Sent here rather than fetched separately so the
        // question screen renders in one round-trip.
        imageUrl: question.imageUrl ?? null,
        // How many answers are correct — never *which* ones. The editor now
        // authors a single correct answer, but this endpoint must stay correct
        // for questions stored before that, where a key can hold several
        // indices, and grading requires an exact set match.
        //
        // Without it the child screen has to guess: the badge says "PILIHAN
        // GANDA" (one answer) while the options are multi-select, so a child
        // who taps a second option scores zero with no way to know why.
        multiAnswer:
          question.type === "multiple_choice" &&
          Array.isArray(question.correctAnswer) &&
          question.correctAnswer.length > 1,
      },
      previousAnswer: prevAnswer,
    });
  } catch (e) {
    console.error("[play fetch]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

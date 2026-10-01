// POST /api/quiz/[id]/publish — Publish/unpublish quiz
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getQuizById,
  getUserById,
  countQuestionsByQuiz,
  listQuizQuestions,
  publishQuiz,
  unpublishQuiz,
} from "@/lib/queries/data";

/**
 * Questions are created as drafts (the editor posts an empty prompt and the
 * user fills it in inline), so publish is the first point where a question
 * can be guaranteed complete. Previously this route only checked that the
 * count was > 0, which let a quiz with blank prompts/options through to the
 * child.
 */
type Problem = { index: number; reason: string };

async function findIncomplete(quizId: string): Promise<Problem[]> {
  const problems: Problem[] = [];
  (await listQuizQuestions(quizId)).forEach((q, i) => {
    const n = i + 1;
    if (!q.prompt || q.prompt.trim().length < 3) {
      problems.push({ index: n, reason: "prompt kosong" });
      return;
    }
    if (q.type === "multiple_choice") {
      const opts = (q.options ?? []).map((o) => (o ?? "").trim());
      const filled = opts.filter((o) => o.length > 0);
      if (filled.length < 2) {
        problems.push({ index: n, reason: "butuh minimal 2 opsi yang terisi" });
        return;
      }
      const correct = q.correctAnswer ?? [];
      if (correct.length === 0) {
        problems.push({ index: n, reason: "belum ada jawaban benar" });
        return;
      }
      if (correct.some((i2) => i2 < 0 || i2 >= opts.length || !opts[i2])) {
        problems.push({ index: n, reason: "jawaban benar menunjuk ke opsi kosong" });
        return;
      }
    } else {
      const kws = (q.keywords ?? []).map((k) => (k ?? "").trim());
      if (!kws.some((k) => k.length > 0)) {
        problems.push({ index: n, reason: "belum ada keyword" });
        return;
      }
      if ((q.keywords ?? []).length !== (q.keywordWeights ?? []).length) {
        problems.push({ index: n, reason: "jumlah keyword != jumlah bobot" });
      }
    }
  });
  return problems;
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = await getUserById(session.user.id);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { id } = await params;
    const quiz = await getQuizById(id);
    if (!quiz) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (quiz.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (quiz.status === "ready") {
      await unpublishQuiz(id);
      return NextResponse.json({ status: "draft" });
    }

    const count = await countQuestionsByQuiz(id);
    if (count === 0) {
      return NextResponse.json(
        { error: "Tambah minimal 1 soal sebelum publish." },
        { status: 400 },
      );
    }

    const problems = await findIncomplete(id);
    if (problems.length > 0) {
      return NextResponse.json(
        {
          error: `Soal nomor ${problems.map((p) => p.index).join(", ")} belum lengkap.`,
          problems,
        },
        { status: 400 },
      );
    }

    await publishQuiz(id);
    return NextResponse.json({ status: "ready" });
  } catch (e) {
    console.error("[publish quiz]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

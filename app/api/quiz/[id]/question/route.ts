// POST /api/quiz/[id]/question — Add question to quiz
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { questionSchema, fieldErrorsOf } from "@/lib/question-schema";
import {
  getQuizById,
  getUserById,
  addQuestion,
  countQuestionsByQuiz,
  getQuestionById,
} from "@/lib/queries/data";

/**
 * A question is created as a DRAFT and filled in afterwards.
 *
 * The editor (QuizEditor.addQuestion) deliberately posts
 * `{ prompt: "", options: ["", ""], keywords: [""] }` and then types into it
 * inline, saving on blur. The previous schema demanded `prompt.min(3)` and
 * `options.min(1)`, so every "Tambah soal" click came back 400 and the
 * feature could never be used at all.
 *
 * Completeness is enforced where it actually matters — at publish time,
 * see /api/quiz/[id]/publish — so an unfinished question can exist in a
 * draft but can never reach a child.
 *
 * The schemas now live in lib/question-schema.ts so this route and the PATCH
 * route cannot drift apart. They used to exist only here, which left the
 * update path completely unvalidated.
 */
const MAX_QUESTIONS = 50;

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

    const { id } = await params;
    const quiz = await getQuizById(id);
    if (!quiz) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (quiz.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const existing = await countQuestionsByQuiz(id);
    if (existing >= MAX_QUESTIONS) {
      return NextResponse.json(
        { error: `Maksimal ${MAX_QUESTIONS} soal per kuis` },
        { status: 400 },
      );
    }

    const body = await req.json();
    const parsed = questionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid input",
          fieldErrors: fieldErrorsOf(parsed.error),
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    if (parsed.data.type === "multiple_choice") {
      const maxIdx = parsed.data.options.length - 1;
      if (parsed.data.correctAnswer.some((i) => i > maxIdx)) {
        return NextResponse.json(
          { error: "correctAnswer harus valid index dari options" },
          { status: 400 },
        );
      }
    }
    if (parsed.data.type === "essay") {
      if (parsed.data.keywords.length !== parsed.data.keywordWeights.length) {
        return NextResponse.json(
          { error: "keywords dan weights harus jumlah sama" },
          { status: 400 },
        );
      }
    }

    // Return the MAPPED question, not the raw row. addQuestion() hands back
    // the snake_case DB row with `options`/`correct_answer` still JSON
    // strings; the editor does `local.options?.map(...)`, which throws on a
    // string. listQuizQuestions() already maps via mapQuestion, so the
    // response shape has to match it.
    const created = await addQuestion({
      quizId: id,
      type: parsed.data.type,
      prompt: parsed.data.prompt,
      options: parsed.data.type === "multiple_choice" ? parsed.data.options : null,
      correctAnswer:
        parsed.data.type === "multiple_choice" ? parsed.data.correctAnswer : null,
      keywords: parsed.data.type === "essay" ? parsed.data.keywords : null,
      keywordWeights:
        parsed.data.type === "essay" ? parsed.data.keywordWeights : null,
      imageUrl: parsed.data.imageUrl ?? null,
      points: parsed.data.points,
    });

    const question = (await getQuestionById(created.id)) ?? created;
    return NextResponse.json({ question });
  } catch (e) {
    console.error("[add question]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

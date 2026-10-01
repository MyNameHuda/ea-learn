// DELETE/PATCH /api/quiz/[id]/question/[qid]
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { questionSchema, fieldErrorsOf } from "@/lib/question-schema";
import {
  getQuizById,
  getUserById,
  getQuestionById,
  deleteQuestion,
  updateQuestion,
} from "@/lib/queries/data";

/**
 * The index of the correct answer must still point inside the options.
 *
 * Deleting an option renumbers the key, and the editor does that client-side.
 * This is the backstop for anything that reaches PATCH without going through
 * the editor — a script, curl, a future client.
 */
function keyOutOfRange(options: string[], key: number[]) {
  const max = options.length - 1;
  return key.some((i) => i > max);
}

async function checkOwnership(qid: string, uid: string) {
  const q = await getQuizById(qid);
  return q && q.userId === uid;
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; qid: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id, qid } = await params;
    if (!(await checkOwnership(id, session.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const q = await getQuestionById(qid);
    if (!q || q.quizId !== id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await deleteQuestion(qid);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[delete question]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; qid: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id, qid } = await params;
    if (!(await checkOwnership(id, session.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const q = await getQuestionById(qid);
    if (!q || q.quizId !== id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();

    // This route used to hand the raw body to await updateQuestion() with no checks
    // whatsoever — and PATCH is the path the editor takes every time a field
    // loses focus, including the answer key. So the "one correct answer" rule
    // could be written here even while the add route enforced it.
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
    // Narrow on the discriminant before touching options/correctAnswer: those
    // fields only exist on the multiple_choice branch of the union, and
    // TypeScript is right to refuse them otherwise.
    if (
      parsed.data.type === "multiple_choice" &&
      keyOutOfRange(parsed.data.options, parsed.data.correctAnswer)
    ) {
      return NextResponse.json(
        { error: "correctAnswer harus valid index dari options" },
        { status: 400 },
      );
    }

    await updateQuestion(qid, parsed.data);
    return NextResponse.json({ ok: true });  } catch (e) {
    console.error("[update question]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

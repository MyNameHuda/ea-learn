// DELETE /api/quiz/[id]/delete — Delete a quiz
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getQuizById, getUserById, deleteQuiz } from "@/lib/queries/data";

export async function DELETE(
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

    await deleteQuiz(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[delete quiz]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

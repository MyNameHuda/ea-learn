// PATCH /api/quiz/[id]/update — Update quiz metadata
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getQuizById, getUserById, updateQuiz } from "@/lib/queries/data";

const updateSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  // Free text, matching POST /api/quiz/create. Empty string clears the field
  // rather than failing, because the editor saves on blur and a field the
  // parent empties on purpose should clear, not throw.
  subject: z.string().trim().max(50).nullable().optional(),
  ageRange: z.string().trim().min(1).max(30).optional(),
});

export async function PATCH(
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

    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    await updateQuiz(id, parsed.data);
    const updated = await getQuizById(id);
    return NextResponse.json({ quiz: updated });
  } catch (e) {
    console.error("[update quiz]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

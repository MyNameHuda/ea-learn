// POST /api/quiz/create â€” Create new quiz (draft)
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getUserById } from "@/lib/queries/data";
import { createQuiz } from "@/lib/queries/data";

const createSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  // Free text on request: the parent types their own category and their own
  // child's age. Was a three-value list, which rejected real answers like
  // "TK B" or "kelas 4". Trimmed so " Matematika " does not become a subject
  // that matches nothing later.
  subject: z.string().trim().max(50).optional(),
  ageRange: z
    .string()
    .trim()
    .min(1, "Usia target anak wajib diisi")
    .max(30, "Usia target anak maksimal 30 karakter"),
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = await getUserById(session.user.id);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const quiz = await createQuiz({
      userId: user.id,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      subject: parsed.data.subject ?? null,
      ageRange: parsed.data.ageRange,
    });

    return NextResponse.json({
      id: quiz.id,
      title: quiz.title,
      shareUuid: quiz.shareUuid,
    });
  } catch (e) {
    console.error("[create quiz]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

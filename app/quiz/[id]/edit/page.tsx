import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getQuizById,
  getUserById,
  listQuizQuestions,
} from "@/lib/queries/data";
import {
  QuizEditor,
  type QuizQuestion,
} from "@/components/QuizEditor";

export default async function QuizEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = await getUserById(session.user.id);
  if (!user) redirect("/login");

  const { id } = await params;
  const quiz = await getQuizById(id);
  if (!quiz) notFound();
  if (quiz.userId !== user.id) notFound();

  const rawQuestions = await listQuizQuestions(id);
  // `imageUrl` is included here because this projection is written by hand.
  // Leaving it out did not fail the build — a QuizQuestion without the field is
  // still a valid QuizQuestion, since imageUrl is optional — it just quietly
  // showed the editor's "tambah gambar" picker for a question that already had
  // a picture, and any pick replaced it. A hand-written field list is a trap:
  // adding a field to the row and the type is not enough, every place that
  // copies fields has to be updated too, and nothing points at them.
  const initialQuestions: QuizQuestion[] = rawQuestions.map((q) => ({
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    options: q.options ?? undefined,
    correctAnswer: q.correctAnswer ?? undefined,
    keywords: q.keywords ?? undefined,
    keywordWeights: q.keywordWeights ?? undefined,
    imageUrl: q.imageUrl ?? null,
    points: q.points,
    orderIndex: q.orderIndex,
  }));

  return (
    <QuizEditor
      quiz={{
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        subject: quiz.subject,
        ageRange: quiz.ageRange,
        status: quiz.status,
        shareUuid: quiz.shareUuid,
      }}
      initialQuestions={initialQuestions}
    />
  );
}

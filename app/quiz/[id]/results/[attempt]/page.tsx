// Server-side loader for attempt detail
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getAttemptById,
  getQuizById,
  getUserById,
  getAnswersWithQuestionsForAttempt,
} from "@/lib/queries/data";
import {
  AttemptDetail,
  type AttemptAnswer,
} from "@/components/AttemptDetail";

export default async function AttemptDetailPage({
  params,
}: {
  params: Promise<{ id: string; attempt: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = await getUserById(session.user.id);
  if (!user) redirect("/login");

  const { id: quizId, attempt: attemptId } = await params;
  const quiz = await getQuizById(quizId);
  if (!quiz) notFound();
  if (quiz.userId !== user.id) notFound();

  const attempt = await getAttemptById(attemptId);
  if (!attempt) notFound();
  if (attempt.quizId !== quiz.id) notFound();

  const combined = await getAnswersWithQuestionsForAttempt(attemptId);

  const answers: AttemptAnswer[] = combined.map(({ answer, question }) => ({
    id: answer.id,
    question_id: question.id,
    question_index: question.orderIndex,
    prompt: question.prompt,
    type: question.type as "multiple_choice" | "essay",
    response: answer.response,
    options: question.options ?? undefined,
    correct_answer: question.correctAnswer ?? undefined,
    image_url: question.imageUrl ?? null,
    keywords: question.keywords ?? undefined,
    keyword_weights: question.keywordWeights ?? undefined,
    auto_score: answer.auto_score,
    final_score: answer.final_score,
    parent_comment: answer.parent_comment,
    points: question.points,
  }));

  return (
    <AttemptDetail
      quiz={{ id: quiz.id, title: quiz.title }}
      attempt={{
        id: attempt.id,
        child_name: attempt.childName,
        total_score: attempt.totalScore ?? 0,
        max_score: attempt.maxScore,
        submitted_at: attempt.submittedAt,
      }}
      answers={answers}
    />
  );
}
